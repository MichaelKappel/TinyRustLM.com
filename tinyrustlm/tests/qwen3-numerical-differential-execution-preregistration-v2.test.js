"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const owner = require("../tools/qwen3-numerical-execution-owner.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const registrationRelativePath =
  "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v2.json";
const registrationPath = path.join(repositoryRoot,
  ...registrationRelativePath.split("/"));
const registrationBytes = fs.readFileSync(registrationPath);
const registration = JSON.parse(registrationBytes.toString("utf8"));
const parentCommit = "4891e8aa15523430e2050c8370baed593d7a19d9";
const parentTree = "c0a2e869ef2ab00abe339b1701764a64547a7c7a";
const operationId = "qwen3-numerical-c1899de-4891e8a-20260826-v2";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytes(commit, relativePath) {
  return childProcess.execFileSync("git", ["show", `${commit}:${relativePath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
}

function gitText(argumentsList) {
  return childProcess.execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  }).trim();
}

function gitObjectExists(specification) {
  return childProcess.spawnSync("git", ["cat-file", "-e", specification], {
    cwd: repositoryRoot,
    encoding: "buffer",
    windowsHide: true
  }).status === 0;
}

function implementationArtifactReference(role) {
  const artifact = registration.ownerContract.implementationArtifacts
    .find((candidate) => candidate.role === role);
  assert.ok(artifact, role);
  return {
    byteLength: artifact.byteLength,
    relativePath: artifact.relativePath,
    sha256: artifact.sha256
  };
}

function assertParentArtifact(artifact) {
  const relativePath = artifact.relativePath ?? artifact.path;
  const bytes = gitBytes(parentCommit, relativePath);
  assert.equal(bytes.length, artifact.byteLength, relativePath);
  assert.equal(sha256(bytes), artifact.sha256, relativePath);
}

function tokenDigest(tokenIds) {
  const bytes = Buffer.alloc(tokenIds.length * 4);
  tokenIds.forEach((tokenId, index) => bytes.writeUInt32LE(tokenId, index * 4));
  return sha256(bytes);
}

test("freezes one canonical output-free v2 numerical registration", () => {
  assert.equal(registrationBytes.length, 24806);
  assert.equal(sha256(registrationBytes),
    "27b0f98a4b00b0561b4e50d7bf6d31d257a91f02c3f33f6c5a8197c652529c77");
  assert.deepEqual(registrationBytes, owner.canonicalJsonBytes(registration));
  assert.throws(() => owner.validateRegistration(registration),
    /numerical-execution-registration-identity/u);
  assert.equal(registration.schema,
    "tinyrustlm.qwen3_numerical_differential_execution_preregistration.v2");
  assert.equal(registration.profileId,
    "tinyrustlm.qwen3-numerical-differential-execution/2");
  assert.equal(registration.status,
    "registered-before-private-request-roots-and-real-traces");
  assert.equal(registration.registeredAtUtc, "2026-08-26T17:39:04Z");
});

test("binds the exact clean remote memory parent and four-file closure", () => {
  assert.equal(registration.registrationParentCommit, parentCommit);
  assert.equal(registration.registrationParentTree, parentTree);
  assert.equal(gitText(["rev-parse", `${parentCommit}^{tree}`]), parentTree);
  assert.equal(registration.sourceAnchor.parentCommit, parentCommit);
  assert.equal(registration.sourceAnchor.parentTree, parentTree);
  assert.deepEqual(registration.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    registrationRelativePath,
    "docs/architecture/2026-08-26-qwen3-numerical-differential-execution-preregistration-v2.md",
    "tinyrustlm/tests/qwen3-numerical-differential-execution-preregistration-v2.test.js"
  ]);
  assert.equal(registration.sourceAnchor.cleanAtRegistration, true);
  assert.equal(registration.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration,
    true);
  assert.equal(gitObjectExists(`${parentCommit}:${registrationRelativePath}`), false);
});

test("recomputes the six reviewed report authorities from the parent", () => {
  assert.deepEqual(Object.keys(registration.reportLineage), [
    "architecture",
    "correctedSynthesis",
    "durableModelLoadMemory",
    "durableNumericalMemory",
    "manifest",
    "tddDelta"
  ]);
  for (const artifact of Object.values(registration.reportLineage)) {
    assertParentArtifact(artifact);
  }
});

test("recomputes all eleven implementation artifacts and ancestor checkpoints", () => {
  const artifacts = registration.ownerContract.implementationArtifacts;
  assert.deepEqual(artifacts.map((artifact) => artifact.role), [
    "execution-owner",
    "differential-profile",
    "environment-authority",
    "environment-lock",
    "source-owner",
    "reconstructed-owner",
    "scalar-source",
    "scalar-profile",
    "verifier",
    "source-lock",
    "composition-result"
  ]);
  for (const artifact of artifacts) assertParentArtifact(artifact);
  const checkpoint = registration.implementationCheckpoint;
  assert.equal(checkpoint.implementationCommit,
    "787c7d3f4e23ff141514ba292667a852fd688580");
  assert.equal(checkpoint.implementationTree,
    "2512e6f409b9664700bfe1e49646d524b7715dab");
  assert.equal(checkpoint.memoryCheckpointCommit, parentCommit);
  assert.equal(checkpoint.memoryCheckpointTree, parentTree);
  for (const commit of [checkpoint.implementationCommit,
    checkpoint.scalarBuild.sourceCommit]) {
    assert.equal(gitText(["merge-base", "--is-ancestor", commit, parentCommit]), "");
  }
});

test("binds the observed source model and executable identities without paths", () => {
  assert.equal(registration.candidate.modelId, "Qwen/Qwen3-0.6B");
  assert.equal(registration.candidate.revision,
    "c1899de289a04d12100db370d81485cdf75e47ca");
  assert.equal(registration.candidate.sourceClosureRehashedBeforeRegistration, true);
  assert.deepEqual(registration.candidate.modelSlm2, {
    byteLength: 598308416,
    sha256: "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7"
  });
  assert.deepEqual(Object.fromEntries(Object.entries(
    registration.ownerContract.executables).map(([role, value]) => [role,
    [value.basename, value.byteLength, value.sha256]])), {
    git: ["git.exe", 46920,
      "c470d205517c7a53ceca321df16a6e4549fcd52b576ab4d09536d36f26fda5a9"],
    node: ["node.exe", 91380224,
      "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088"],
    python: ["python.exe", 104952,
      "4d6f5f81a4bca11191c4c7c6b43632694d0a4ce74e068619d8fdc161d469859a"],
    scalar: ["tinyrustlm-numerical-probe.exe", 319488,
      "a15a09aed375f764ae981c33e5710667990f84b29134e966e22aef9b036a4827"],
    termination: ["taskkill.exe", 114688,
      "81e9649b317de9243bf7f34e436e86159ba267d86349fa47efdb71dde2fc7bc5"]
  });
  const text = registrationBytes.toString("utf8");
  assert.doesNotMatch(text, /[A-Z]:[\\/]/u);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
});

test("closes the exact v2 source-framework request without ambient defaults", () => {
  const source = registration.ownerContract.requests.source;
  assert.equal(source.schema, owner.SOURCE_REQUEST_SCHEMA);
  assert.deepEqual(source.framework, {
    accelerateVersion: "1.14.0",
    attentionImplementation: "eager",
    deterministicAlgorithms: true,
    device: "cpu",
    dtype: "float32",
    environmentAuthority: implementationArtifactReference("environment-authority"),
    environmentLock: implementationArtifactReference("environment-lock"),
    interopThreads: 1,
    intraopThreads: 1,
    localFilesOnly: true,
    networkAllowed: false,
    numpyVersion: "2.2.5",
    psutilVersion: "7.2.2",
    pythonVersion: "3.12.10",
    safetensorsVersion: "0.5.3",
    tokenizersVersion: "0.21.1",
    torchVersion: "2.7.0",
    transformersVersion: "4.51.0"
  }, "framework references intentionally include no role field");
});

test("freezes three token-only cases and both pre-output proof arrows", () => {
  const cases = registration.ownerContract.cases;
  assert.deepEqual(cases.map((item) => [item.id, item.tokenIds]), [
    ["low-vocabulary-boundary", [0]],
    ["repeated-kv-position", [17, 17]],
    ["high-vocabulary-mixed-cache", [151935, 151645, 220, 151935]]
  ]);
  for (const item of cases) {
    assert.equal(item.tokenIdsLeU32Sha256, tokenDigest(item.tokenIds), item.id);
  }
  const comparison = registration.ownerContract.requests.verification.comparison;
  assert.deepEqual(comparison.arrows.map((arrow) => [arrow.id, arrow.reference,
    arrow.candidate, arrow.requireGreedyTokenIdentity,
    arrow.minimumTopKOverlap]), [
    ["source-to-reconstructed", "source", "reconstructed", false, 0.8],
    ["reconstructed-to-scalar", "reconstructed", "scalar", true, 1]
  ]);
  assert.equal(registration.implementationCheckpoint.thresholdBasis
    .futureOutputUsedToChooseOrLoosen, false);
  assert.equal(registration.ownerContract.terminalPolicy
    .thresholdChangeAfterLaunchAllowed, false);
});

test("binds the clean gates and bounded process geometry", () => {
  const checkpoint = registration.implementationCheckpoint;
  assert.deepEqual(checkpoint.focusedGate,
    { failed: 0, passed: 27, skipped: 0, total: 27 });
  assert.deepEqual(checkpoint.standardGate, {
    declaredInfrastructureOnlySkips: 2,
    failed: 0,
    passed: 1574,
    total: 1576
  });
  assert.deepEqual(checkpoint.cleanRelease, {
    aggregateByteLength: 3995,
    aggregateSha256:
      "9be258173ae2e28c0e7bf754667c6f9c1ccba1ae2bf8c1aea930d9524949b3b7",
    failed: 0,
    passed: 23,
    runId:
      "7e320cf108b751768a780083c7a8c59ec40b846508eaf8d4a4389e4c31d60bbb",
    skipped: 0,
    total: 23,
    verifierReproduced: true
  });
  assert.deepEqual(registration.ownerContract.processPolicy
    .maximumDurationMilliseconds, {
    reconstructed: 14400000,
    scalar: 14400000,
    source: 14400000,
    verifier: 3600000
  });
  assert.equal(registration.ownerContract.processPolicy.launchLimitPerStage, 1);
  assert.equal(registration.ownerContract.processPolicy.retryAllowed, false);
});

test("registers six absent logical names and no material output", () => {
  assert.equal(registration.ownerContract.operationId, operationId);
  assert.deepEqual(registration.ownerContract.privateNames, {
    ownerEvidenceRootBasename: `${operationId}-owner-evidence`,
    ownerRequestFileBasename: `${operationId}-owner-request.json`,
    reconstructedOutputRootBasename: `${operationId}-reconstructed`,
    scalarOutputRootBasename: `${operationId}-scalar`,
    sourceOutputRootBasename: `${operationId}-source`,
    sourceScratchRootBasename: `${operationId}-source-scratch`
  });
  assert.equal(new Set(Object.values(registration.ownerContract.privateNames)).size, 6);
  assert.deepEqual(registration.outputBoundary, {
    allSixRegisteredFutureNamesObservedAbsent: true,
    evidenceParentObservedExistingDirectNonReparse: true,
    ownerEvidenceRootCreated: false,
    ownerRequestCreated: false,
    privatePathPublished: false,
    realProcessLaunched: false,
    realTraceBytesCreated: false,
    reconstructedOutputRootCreated: false,
    scalarOutputRootCreated: false,
    sourceOutputRootCreated: false,
    sourceScratchRootCreated: false
  });
});

test("keeps every broader claim and campaign counter closed", () => {
  assert.deepEqual(registration.campaignCounters, {
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    deletionBackedBrowserRounds: "0/50",
    liveCatalogAnnouncements: "0/20",
    qualifiedModels: "0/20"
  });
  assert.equal(registration.claimBoundary.compositionStructuralPassBound, true);
  assert.equal(registration.claimBoundary
    .registrationCommitMustBeRemoteExactBeforeMaterialization, true);
  for (const [key, value] of Object.entries(registration.claimBoundary)) {
    if (key === "compositionStructuralPassBound"
        || key === "registrationCommitMustBeRemoteExactBeforeMaterialization") continue;
    assert.equal(value, false, key);
  }
  assert.equal(registration.authority.legacySupport, false);
  assert.equal(registration.authority.compatibilityReader, false);
  assert.equal(registration.authority.fallbackRuntime, false);
  assert.equal(registration.authority.memoryEndpointsAuthorized, false);
});
