"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  defaultPath,
  expectedAuthority,
  expectedLanes,
  expectedManifestSha256,
  expectedParents,
  schema,
  validateManifest,
  validateManifestFile
} = require("../tools/vector-turbovec-reference-preregistration.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalManifest() {
  return clone(validateManifestFile(defaultPath).manifest);
}

test("validates the canonical TurboVec native reference preregistration", () => {
  const priorDataset = process.env.TINYRUSTLM_FASHION_MNIST_ROOT;
  const priorCrate = process.env.TINYRUSTLM_TURBOVEC_CRATE_ARCHIVE;
  process.env.TINYRUSTLM_FASHION_MNIST_ROOT =
    "Z:\\intentionally-missing-external-dataset";
  process.env.TINYRUSTLM_TURBOVEC_CRATE_ARCHIVE =
    "Z:\\intentionally-missing-external-crate";
  try {
    const result = validateManifestFile(defaultPath);
    assert.equal(result.manifest.schema, schema);
    assert.equal(result.manifest.status,
      "preregistered-after-source-screen-before-comparison-implementation-or-results");
    assert.deepEqual(result.manifest.parents, expectedParents);
    assert.deepEqual(result.manifest.corpusReuse.lanes, expectedLanes);
    assert.deepEqual(result.manifest.authority, expectedAuthority);
    assert.equal(result.manifest.method.bitWidth, 4);
    assert.equal(result.manifest.sourceScreen.qualityCorpusExecuted, false);
    assert.equal(
      result.manifest.sourceScreen.wasmCheck.directBrowserCompatibilityObserved,
      false
    );
    assert.equal(result.sha256, expectedManifestSha256);
  } finally {
    if (priorDataset === undefined) {
      delete process.env.TINYRUSTLM_FASHION_MNIST_ROOT;
    } else {
      process.env.TINYRUSTLM_FASHION_MNIST_ROOT = priorDataset;
    }
    if (priorCrate === undefined) {
      delete process.env.TINYRUSTLM_TURBOVEC_CRATE_ARCHIVE;
    } else {
      process.env.TINYRUSTLM_TURBOVEC_CRATE_ARCHIVE = priorCrate;
    }
  }
});

test("rejects baseline parent and claim-ledger drift", () => {
  const parent = canonicalManifest();
  parent.parents[2].contentHash = "0".repeat(64);
  assert.throws(() => validateManifest(parent), /parents is invalid/u);

  const ledger = canonicalManifest();
  ledger.sourcePin.claimLedger.sha256 = "0".repeat(64);
  assert.throws(() => validateManifest(ledger), /sourcePin contract is invalid/u);
});

test("rejects crate revision, package, artifact, and license drift", () => {
  const revision = canonicalManifest();
  revision.sourcePin.crate.vcsRevision = "0".repeat(40);
  assert.throws(() => validateManifest(revision),
    /sourcePin crate revision is invalid/u);

  const packageVersion = canonicalManifest();
  packageVersion.sourcePin.crate.version = "0.9.1";
  assert.throws(() => validateManifest(packageVersion),
    /sourcePin crate package identity is invalid/u);

  const artifact = canonicalManifest();
  artifact.sourcePin.crate.artifactSha256 = "0".repeat(64);
  assert.throws(() => validateManifest(artifact), /sourcePin contract is invalid/u);

  const license = canonicalManifest();
  license.sourcePin.crate.licenseExpression = "UNKNOWN";
  assert.throws(() => validateManifest(license), /sourcePin crate license is invalid/u);
});

test("rejects source-screen claim inflation and a hidden comparison run", () => {
  const quality = canonicalManifest();
  quality.sourceScreen.qualityCorpusExecuted = true;
  assert.throws(() => validateManifest(quality),
    /sourceScreen crossed the preregistration boundary/u);

  const results = canonicalManifest();
  results.sourceScreen.compressedComparisonResultsObserved = true;
  assert.throws(() => validateManifest(results),
    /sourceScreen crossed the preregistration boundary/u);

  const wasm = canonicalManifest();
  wasm.sourceScreen.wasmCheck.directBrowserCompatibilityObserved = true;
  assert.throws(() => validateManifest(wasm), /sourceScreen wasm blocker is invalid/u);
});

test("rejects method, bit width, ablation, reranking, and best-of-N drift", () => {
  const bitWidth = canonicalManifest();
  bitWidth.method.bitWidth = 2;
  assert.throws(() => validateManifest(bitWidth),
    /method identity or fixed parameters are invalid/u);

  const ablation = canonicalManifest();
  ablation.method.featureAblationAllowed = true;
  assert.throws(() => validateManifest(ablation),
    /method\.featureAblationAllowed must remain false/u);

  const rerank = canonicalManifest();
  rerank.method.sourceVectorRerankingAllowed = true;
  assert.throws(() => validateManifest(rerank),
    /method\.sourceVectorRerankingAllowed must remain false/u);

  const bestOf = canonicalManifest();
  bestOf.method.bestOfNAllowed = true;
  assert.throws(() => validateManifest(bestOf),
    /method\.bestOfNAllowed must remain false/u);
});

test("rejects corpus identity, dimension, lane, and byte-accounting drift", () => {
  const selection = canonicalManifest();
  selection.corpusReuse.selectionSha256 = "0".repeat(64);
  assert.throws(() => validateManifest(selection),
    /corpusReuse parent or selection identity is invalid/u);

  const dimension = canonicalManifest();
  dimension.corpusReuse.lanes[0].encodedDimension = 791;
  assert.throws(() => validateManifest(dimension),
    /encoded dimension is invalid/u);

  const candidateBytes = canonicalManifest();
  candidateBytes.corpusReuse.lanes[1].candidateDynamicIndexBytes += 1;
  assert.throws(() => validateManifest(candidateBytes),
    /candidate byte formula is invalid/u);

  const exactCapacity = canonicalManifest();
  exactCapacity.corpusReuse.lanes[2].capacityMatchedExactRecordCount -= 1;
  assert.throws(() => validateManifest(exactCapacity),
    /exact control byte formula is invalid/u);
});

test("rejects Euclidean transform and hidden-byte accounting changes", () => {
  const transform = canonicalManifest();
  transform.metricAdapters.squaredEuclidean.queryTransform =
    "[x,1,zero-padding]";
  assert.throws(() => validateManifest(transform),
    /metricAdapters contract is invalid/u);

  const padding = canonicalManifest();
  padding.metricAdapters.squaredEuclidean.paddingCountsTowardEffectiveBytes = false;
  assert.throws(() => validateManifest(padding),
    /metricAdapters squared-Euclidean accounting is invalid/u);

  const shadow = canonicalManifest();
  shadow.byteAccounting.decodedF32ShadowAllowed = true;
  assert.throws(() => validateManifest(shadow),
    /byteAccounting\.decodedF32ShadowAllowed must remain false/u);

  const misleadingClaim = canonicalManifest();
  misleadingClaim.byteAccounting.sameCorpusComparisonMayBeCalledEqualByte = true;
  assert.throws(() => validateManifest(misleadingClaim),
    /sameCorpusComparisonMayBeCalledEqualByte must remain false/u);
});

test("rejects quality or performance threshold weakening and outcome retries", () => {
  const recall = canonicalManifest();
  recall.qualityThresholds.sameCorpusAllLanes.minimumRecallAt10 = 0.8;
  assert.throws(() => validateManifest(recall),
    /qualityThresholds same-corpus gate is invalid/u);

  const privacy = canonicalManifest();
  privacy.qualityThresholds.controlledMemoryLane.maximumForbiddenHitRateAt10 = 0.01;
  assert.throws(() => validateManifest(privacy),
    /qualityThresholds controlled-memory gate is invalid/u);

  const performance = canonicalManifest();
  performance.performanceThresholds.maximumMedianSteadyQueryLatencyRatioToExact = 2;
  assert.throws(() => validateManifest(performance),
    /performanceThresholds comparison limits are invalid/u);

  const retry = canonicalManifest();
  retry.performanceThresholds.performanceOutcomeFailureMayBeRetried = true;
  assert.throws(() => validateManifest(retry),
    /performanceThresholds authority or retry policy is invalid/u);
});

test("rejects corruption, crash, deletion, and persistence safety weakening", () => {
  const corruption = canonicalManifest();
  corruption.persistenceAndFailure.corruptionCases.pop();
  assert.throws(() => validateManifest(corruption),
    /persistenceAndFailure corruption gate is invalid/u);

  const crash = canonicalManifest();
  crash.persistenceAndFailure.crashScenarios.reverse();
  assert.throws(() => validateManifest(crash),
    /persistenceAndFailure\.crashScenarios is invalid/u);

  const deletion = canonicalManifest();
  deletion.persistenceAndFailure.committedDeletedIdsMayRemainSearchable = true;
  assert.throws(() => validateManifest(deletion),
    /persistenceAndFailure deletion or recovery gate is invalid/u);

  const upstream = canonicalManifest();
  upstream.persistenceAndFailure.upstreamPersistenceSafetyClaimAllowed = true;
  assert.throws(() => validateManifest(upstream),
    /persistenceAndFailure authority exceeds/u);
});

test("rejects network, precommit execution, result repair, and path disclosure", () => {
  const network = canonicalManifest();
  network.execution.networkPolicy = "allow";
  assert.throws(() => validateManifest(network),
    /execution network or process policy is invalid/u);

  const precommit = canonicalManifest();
  precommit.execution.comparisonRunAllowedOnlyAfterPreregistrationCommit = false;
  assert.throws(() => validateManifest(precommit), /execution result boundary is invalid/u);

  const repair = canonicalManifest();
  repair.execution.resultRepairAllowed = true;
  assert.throws(() => validateManifest(repair), /execution result boundary is invalid/u);

  const privatePath = canonicalManifest();
  privatePath.requiredNextGate = "Read C:\\Users\\Private\\secret.txt";
  assert.throws(() => validateManifest(privatePath),
    /manifest contains a private path/u);
});

test("rejects authority inflation, external-byte admission, and semantic retries", () => {
  const authority = canonicalManifest();
  authority.authority.wasmCompatibilityMayBeClaimed = true;
  assert.throws(() => validateManifest(authority), /authority is invalid/u);

  const product = canonicalManifest();
  product.authority.productIntegrationMayBeClaimed = true;
  assert.throws(() => validateManifest(product), /authority is invalid/u);

  const externalBytes = canonicalManifest();
  externalBytes.evidencePolicy.externalCrateBytesAllowed = true;
  assert.throws(() => validateManifest(externalBytes),
    /evidencePolicy\.externalCrateBytesAllowed must remain false/u);

  const semanticRetry = canonicalManifest();
  semanticRetry.validity.qualityThresholdFailuresMayBeRetried = true;
  assert.throws(() => validateManifest(semanticRetry),
    /validity\.qualityThresholdFailuresMayBeRetried must remain false/u);
});

test("rejects unknown fields and noncanonical manifest bytes", () => {
  const unknownTopLevel = canonicalManifest();
  unknownTopLevel.easyMode = true;
  assert.throws(() => validateManifest(unknownTopLevel),
    /manifest fields are invalid/u);

  const unknownNested = canonicalManifest();
  unknownNested.method.easyMode = true;
  assert.throws(() => validateManifest(unknownNested),
    /method fields are invalid/u);

  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "tinyrustlm-turbovec-prereg-")
  );
  const filePath = path.join(directory, "manifest.json");
  try {
    fs.writeFileSync(
      filePath,
      `${JSON.stringify(canonicalManifest(), null, 2)}\n\n`,
      "utf8"
    );
    assert.throws(() => validateManifestFile(filePath),
      /manifest bytes are not canonical pretty JSON/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
