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
  "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v1.json";
const registrationPath = path.join(repositoryRoot,
  ...registrationRelativePath.split("/"));
const registrationBytes = fs.readFileSync(registrationPath);
const registration = JSON.parse(registrationBytes.toString("utf8"));

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

function assertParentIdentity(identity) {
  const bytes = gitBytes(registration.registrationParentCommit, identity.relativePath);
  assert.equal(bytes.length, identity.byteLength, identity.relativePath);
  assert.equal(sha256(bytes), identity.sha256, identity.relativePath);
}

function tokenDigest(tokenIds) {
  const bytes = Buffer.alloc(tokenIds.length * 4);
  tokenIds.forEach((tokenId, index) => bytes.writeUInt32LE(tokenId, index * 4));
  return sha256(bytes);
}

test("freezes one canonical output-free numerical registration", () => {
  assert.equal(registrationBytes.length, 24467);
  assert.equal(sha256(registrationBytes),
    "469e003e6f50cb3e4bb0574e2bd72c5836edb938eea0345ca1a23b4bfc9906a1");
  assert.deepEqual(registrationBytes, owner.canonicalJsonBytes(registration));
  assert.equal(owner.validateRegistration(registration), registration);
  assert.equal(registration.schema, owner.REGISTRATION_SCHEMA);
  assert.equal(registration.status,
    "registered-before-private-request-roots-and-real-traces");
});

test("binds the exact remote memory parent and registration-only path closure", () => {
  assert.equal(registration.registrationParentCommit,
    "aece952422313fce4f55e04bf5f6a4d628d9c8a1");
  assert.equal(registration.registrationParentTree,
    "ecf22c16582e42336120809b95f4101a228bdddb");
  assert.equal(gitText(["rev-parse",
    `${registration.registrationParentCommit}^{tree}`]),
  registration.registrationParentTree);
  assert.deepEqual(registration.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    registrationRelativePath,
    "docs/architecture/2026-08-26-qwen3-numerical-differential-execution-preregistration.md",
    "tinyrustlm/tests/qwen3-numerical-differential-execution-preregistration.test.js"
  ]);
  assert.equal(registration.sourceAnchor.cleanAtRegistration, true);
  assert.equal(registration.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration, true);
});

test("recomputes every source-controlled owner input from the parent", () => {
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
  for (const artifact of artifacts) assertParentIdentity(artifact);
  assert.equal(registration.implementationCheckpoint.implementationCommit,
    "77a1c45d376033ee5cb4ccba4bb71df3fd72714b");
  assert.equal(gitText(["merge-base", "--is-ancestor",
    registration.implementationCheckpoint.implementationCommit,
    registration.registrationParentCommit]), "");
});

test("binds exact candidate and local executable observations without publishing paths", () => {
  assert.deepEqual(registration.candidate.modelSlm2, {
    byteLength: 598308416,
    sha256: "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7"
  });
  assert.equal(registration.candidate.sourceClosureRehashedBeforeRegistration, true);
  assert.deepEqual(registration.ownerContract.executables, {
    git: {
      basename: "git.exe",
      byteLength: 46920,
      sha256: "c470d205517c7a53ceca321df16a6e4549fcd52b576ab4d09536d36f26fda5a9"
    },
    node: {
      basename: "node.exe",
      byteLength: 91380224,
      sha256: "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088"
    },
    python: {
      basename: "python.exe",
      byteLength: 104952,
      sha256: "4d6f5f81a4bca11191c4c7c6b43632694d0a4ce74e068619d8fdc161d469859a"
    },
    scalar: {
      basename: "tinyrustlm-numerical-probe.exe",
      byteLength: 319488,
      sha256: "a15a09aed375f764ae981c33e5710667990f84b29134e966e22aef9b036a4827"
    },
    termination: {
      basename: "taskkill.exe",
      byteLength: 114688,
      sha256: "81e9649b317de9243bf7f34e436e86159ba267d86349fa47efdb71dde2fc7bc5"
    }
  });
  const text = registrationBytes.toString("utf8");
  assert.doesNotMatch(text, /[A-Z]:[\\/]/u);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
});

test("freezes three token-only cases and the exact trace resource geometry", () => {
  const cases = registration.ownerContract.cases;
  assert.deepEqual(cases.map((item) => item.tokenIds.length), [1, 2, 4]);
  assert.equal(cases.reduce((total, item) => total + item.tokenIds.length, 0), 7);
  for (const item of cases) {
    assert.equal(tokenDigest(item.tokenIds), item.tokenIdsLeU32Sha256, item.id);
  }
  const requests = registration.ownerContract.requests;
  assert.equal(requests.source.policy.maximumTraceBytes, 14748160);
  assert.equal(requests.reconstructed.policy.maximumTraceBytes, 14748160);
  assert.equal(requests.scalar.policy.maximumTraceBytes, 14748160);
  assert.equal(requests.scalar.policy.maximumKvBytes, 917504);
  assert.equal(requests.scalar.policy.maximumScratchBytes, 673296);
  assert.equal(requests.scalar.policy.maximumSequenceTokens, 4);
});

test("registers both proof arrows and immutable pre-output thresholds", () => {
  const comparison = registration.ownerContract.requests.verification.comparison;
  assert.equal(comparison.chunkElements, 65536);
  assert.equal(comparison.relativeFloor, 0.000001);
  assert.equal(comparison.signFloor, 0.00001);
  assert.equal(comparison.topK, 20);
  assert.deepEqual(comparison.arrows.map((arrow) => [arrow.id, arrow.reference,
    arrow.candidate, arrow.requireGreedyTokenIdentity, arrow.minimumTopKOverlap]), [
    ["source-to-reconstructed", "source", "reconstructed", false, 0.8],
    ["reconstructed-to-scalar", "reconstructed", "scalar", true, 1]
  ]);
  assert.deepEqual(comparison.arrows[1].thresholds.stages["token-embedding"], {
    maximumAbsoluteError: 0,
    maximumNormalizedRmse: 0,
    maximumRelativeError: 0,
    maximumSignDisagreementRate: 0,
    maximumUlp: 0,
    minimumCosineSimilarity: 1
  });
  assert.equal(registration.implementationCheckpoint.thresholdBasis
    .chosenBeforeRealTraceOutput, true);
  assert.equal(registration.implementationCheckpoint.thresholdBasis
    .futureOutputUsedToChooseOrLoosen, false);
  assert.equal(registration.ownerContract.terminalPolicy
    .thresholdChangeAfterLaunchAllowed, false);
});

test("registers one four-stage owner and six wholly new logical names", () => {
  const contract = registration.ownerContract;
  const operationId = "qwen3-numerical-c1899de-aece952-20260826-v1";
  assert.equal(contract.operationId, operationId);
  assert.deepEqual(contract.processPolicy.maximumDurationMilliseconds, {
    reconstructed: 14400000,
    scalar: 14400000,
    source: 14400000,
    verifier: 3600000
  });
  assert.equal(contract.processPolicy.launchLimitPerStage, 1);
  assert.equal(contract.processPolicy.continueAfterFailedStage, false);
  assert.equal(contract.processPolicy.retryAllowed, false);
  assert.equal(contract.processPolicy.overwriteAllowed, false);
  assert.equal(contract.processPolicy.repairAllowed, false);
  assert.deepEqual(Object.values(contract.privateNames), [
    `${operationId}-owner-evidence`,
    `${operationId}-owner-request.json`,
    `${operationId}-reconstructed`,
    `${operationId}-scalar`,
    `${operationId}-source`,
    `${operationId}-source-scratch`
  ]);
  assert.equal(new Set(Object.values(contract.privateNames)).size, 6);
  assert.equal(registration.outputBoundary.allSixRegisteredFutureNamesObservedAbsent, true);
  assert.equal(registration.outputBoundary.realProcessLaunched, false);
  assert.equal(registration.outputBoundary.realTraceBytesCreated, false);
});

test("keeps all broader claims and campaign counters closed", () => {
  assert.deepEqual(registration.campaignCounters, {
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    deletionBackedBrowserRounds: "0/50",
    liveCatalogAnnouncements: "0/20",
    qualifiedModels: "0/20"
  });
  assert.equal(registration.claimBoundary.compositionStructuralPassBound, true);
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
