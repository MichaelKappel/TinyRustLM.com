"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createRegisteredGitTree } = require(
  "./helpers/registered-git-tree.js"
);
const workingRepositoryRoot = path.resolve(__dirname, "../..");
const browserProfilePath = path.join(
  workingRepositoryRoot,
  "contracts/vnext/qwen-tokenizer2-browser-wasm-preregistration.v1.json"
);
const browserProfile = JSON.parse(fs.readFileSync(browserProfilePath, "utf8"));
const registeredTree = createRegisteredGitTree({
  profilePath:
    "contracts/vnext/qwen-tokenizer2-browser-wasm-preregistration.v1.json",
  requiredPaths: [
    "contracts/vnext/qwen-tokenizer2-browser-wasm-verification-preregistration.v1.json",
    ...browserProfile.wasm.sourceClosure.map((entry) => entry.path)
  ],
  linkNodeModules: true
});
test.after(() => registeredTree.dispose());

const {
  sourceClosureSha256,
  validatePreregistrationFile
} = registeredTree.requireModule(
  "tinyrustlm/tools/qwen-tokenizer2-browser-wasm-runner.js"
);
const {
  compareResults,
  resourceSummary,
  validateVerificationProfileFile
} = registeredTree.requireModule(
  "tinyrustlm/tools/qwen-tokenizer2-browser-wasm-verifier.js"
);
const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = registeredTree.repositoryRoot;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function result(caseId, tokenIds = [1, 2]) {
  return {
    caseId,
    tokenIds,
    decodeIncludeAll: "result",
    decodeSkipSpecial: "result"
  };
}

function resource(highWater = 64 * 1024) {
  return {
    instantiateMs: 1,
    artifactLoadMs: 2,
    corpusEncodeMs: 3,
    corpusDecodeIncludeAllMs: 4,
    corpusDecodeSkipSpecialMs: 5,
    totalMs: 15,
    wasmLinearMemoryBytes: {
      beforeLoad: 64 * 1024,
      afterLoad: highWater,
      afterCorpus: highWater,
      highWater,
      afterClear: highWater
    },
    javascriptHeap: {
      beforeLoad: { available: false, usedBytes: 0, totalBytes: 0, limitBytes: 0 },
      afterLoad: { available: false, usedBytes: 0, totalBytes: 0, limitBytes: 0 },
      afterCorpus: { available: false, usedBytes: 0, totalBytes: 0, limitBytes: 0 }
    }
  };
}

function syntheticComparison() {
  const results = [result("case-a"), result("case-b", [])];
  const summary = { caseCount: 2, totalTokenCount: 2, maximumTokenCount: 2 };
  const native = { value: { summary, results } };
  const cancellation = {
    recoveryCaseId: "case-a",
    recoveryTokenIds: [1, 2],
    recoveryDecodeIncludeAll: "result",
    recoveryDecodeSkipSpecial: "result"
  };
  const browserRuns = [
    { value: { runNumber: 1, summary: clone(summary), results: clone(results),
      resources: resource(), cancellation } },
    { value: { runNumber: 2, summary: clone(summary), results: clone(results),
      resources: resource(128 * 1024), cancellation: null } }
  ];
  const execution = {
    profile: {
      corpus: { caseCount: 2 },
      execution: {
        maximumWasmLinearMemoryBytes: 512 * 1024 * 1024,
        browserOperationTimeoutMs: 900000
      }
    }
  };
  return { native, browserRuns, execution };
}

test("pins the no-output browser preregistration and verification profile", () => {
  assert.equal(
    registeredTree.registrationCommit,
    "4461ee0c3c09f42ae44bf1eb9dd0d76ffe0bc8dc"
  );
  assert.equal(
    registeredTree.registrationParentCommit,
    "21a6b733959ad48c9c04cbcb08f47cf4e55fa99f"
  );
  const execution = validatePreregistrationFile();
  const verification = validateVerificationProfileFile(execution);
  assert.equal(execution.bytes.length, 9343);
  assert.equal(execution.sha256,
    "8734360e7fc2e0d4cb4f6ace87e2b5ec2922f983eededa7f5b246fad928050f3");
  assert.equal(verification.bytes.length, 2453);
  assert.equal(verification.sha256,
    "560347bb1db2f1299bc3f54d5e2a8a5d6adbb26e1a55b908c4bb754d72f540a2");
  assert.equal(execution.profile.status,
    "registered-before-full-artifact-browser-output");
  assert.deepEqual(execution.profile.artifact, {
    formatProfileId: "org.minimodel.tokenizer2/2.0",
    basename: "qwen3-0.6b.tokenizer.tok2",
    byteLength: 7038773,
    sha256: "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b",
    tokenCount: 151669,
    baseTokenCount: 151643,
    addedTokenCount: 26
  });
  assert.equal(
    execution.profile.artifact.baseTokenCount +
      execution.profile.artifact.addedTokenCount,
    execution.profile.artifact.tokenCount
  );
  assert.equal(verification.profile.runSet.requiredVerifierRuns, 1);
  assert.equal(verification.profile.runSet.priorRunReuseAllowed, false);
  assert.equal(verification.profile.result.includePromptText, false);
  assert.equal(verification.profile.result.includeDecodedText, false);
  assert.equal(verification.profile.result.includeTokenIds, false);
});

test("binds every source-closure member and the exact external WASM module", () => {
  const execution = validatePreregistrationFile();
  assert.equal(
    sourceClosureSha256(execution.profile.wasm.sourceClosure),
    execution.profile.wasm.sourceClosureSha256
  );
  for (const entry of execution.profile.wasm.sourceClosure) {
    const bytes = fs.readFileSync(path.join(repositoryRoot, ...entry.path.split("/")));
    assert.equal(bytes.length, entry.byteLength, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
  }
  assert.deepEqual(execution.profile.wasm.module, {
    basename: "tinyrustlm_tokenizer2_wasm.wasm",
    byteLength: 320996,
    sha256: "058c6ffb494e90b101409951ba78b4fc7d8098a868c861a276ef3f415ede27cc"
  });
});

test("accepts exact semantic repeats while ignoring object member order", () => {
  const fixture = syntheticComparison();
  fixture.browserRuns[0].value.results = fixture.browserRuns[0].value.results.map((entry) => ({
    decodeSkipSpecial: entry.decodeSkipSpecial,
    tokenIds: entry.tokenIds,
    caseId: entry.caseId,
    decodeIncludeAll: entry.decodeIncludeAll
  }));
  const comparison = compareResults(
    fixture.native, fixture.browserRuns, fixture.execution
  );
  assert.equal(comparison.mismatchCount, 0);
  assert.equal(comparison.exactTokenIds, true);
  assert.equal(comparison.browserRepeatEqual, true);
});

test("rejects token order drift and recovery repair", () => {
  const tokenDrift = syntheticComparison();
  tokenDrift.browserRuns[1].value.results[0].tokenIds.reverse();
  assert.throws(
    () => compareResults(tokenDrift.native, tokenDrift.browserRuns, tokenDrift.execution),
    /browser comparison mismatch/u
  );

  const repaired = syntheticComparison();
  repaired.browserRuns[0].value.cancellation.recoveryTokenIds = [2, 1];
  assert.throws(
    () => compareResults(repaired.native, repaired.browserRuns, repaired.execution),
    /worker-recovery-mismatch/u
  );
});

test("reports observed resources without turning timing into semantic output", () => {
  const fixture = syntheticComparison();
  const summary = resourceSummary(fixture.browserRuns, fixture.execution);
  assert.equal(summary.maximumWasmLinearMemoryBytesObserved, 128 * 1024);
  assert.equal(summary.maximumTotalMsObserved, 15);
  assert.equal(summary.allBoundsSatisfied, true);
  assert.equal(Object.hasOwn(summary, "results"), false);
  assert.equal(Object.hasOwn(summary, "tokenIds"), false);
});

test("forbids hidden retries, repair, legacy fallback, and claim inflation", () => {
  const execution = validatePreregistrationFile().profile;
  assert.equal(execution.execution.hiddenRetry, false);
  assert.equal(execution.execution.resultRepair, false);
  assert.equal(execution.execution.bestOfN, false);
  assert.equal(execution.claimBoundary.modelRuntimeMayBeClaimed, false);
  assert.equal(execution.claimBoundary.modelQualityMayBeClaimed, false);
  assert.equal(execution.claimBoundary.releaseMayBeClaimed, false);
  assert.equal(execution.claimBoundary.campaignCreditMayBeClaimed, false);
});

test("locks the bounded public-safe full-artifact browser result", () => {
  const resultPath = path.join(
    workingRepositoryRoot,
    "tinyrustlm",
    "experiments",
    "qwen3-tokenizer2-browser-wasm-verification-v1.json"
  );
  const bytes = fs.readFileSync(resultPath);
  const resultValue = parseStrictJson(bytes);
  const execution = validatePreregistrationFile();
  const verification = validateVerificationProfileFile(execution);

  assert.equal(bytes.length, 3909);
  assert.equal(
    sha256(bytes),
    "f828190b2ff5d3c1e794cb50f3b0dd8c41367ed09fca758eeb513fb1ec2c964e"
  );
  assert.equal(
    resultValue.schema,
    "tinyrustlm.qwen_tokenizer2_browser_wasm_verification_result.v1"
  );
  assert.equal(resultValue.status, "exact-full-artifact-browser-wasm-parity-verified");
  assert.equal(
    resultValue.registration.executionPreregistrationSha256,
    execution.sha256
  );
  assert.equal(
    resultValue.registration.verificationPreregistrationSha256,
    verification.sha256
  );
  assert.deepEqual(
    resultValue.runs.map((run) => ({
      runNumber: run.runNumber,
      byteLength: run.byteLength,
      sha256: run.sha256,
      sourceRevision: run.sourceRevision,
      cancellationExercised: run.cancellationExercised
    })),
    [
      {
        runNumber: 1,
        byteLength: 1700181,
        sha256: "0ed18293784438035b06d99e8709c382ccef1a775c70f00d624a3964d3c92905",
        sourceRevision: "f4c6cabd05977b07fc8a6a441ec0550ba233bc2f",
        cancellationExercised: true
      },
      {
        runNumber: 2,
        byteLength: 1699041,
        sha256: "fb493d2e251c8efa6e12d73664aa319ad4901235fa46edf5b00fc4b43806e920",
        sourceRevision: "f4c6cabd05977b07fc8a6a441ec0550ba233bc2f",
        cancellationExercised: false
      }
    ]
  );
  assert.deepEqual(resultValue.comparison, {
    mode: "exact-native-to-two-independent-browser-runs",
    caseCount: 2048,
    totalTokenCount: 69294,
    maximumTokenCount: 5966,
    exactCaseOrder: true,
    exactTokenIds: true,
    exactIncludeAllDecode: true,
    exactSkipSpecialDecode: true,
    browserRepeatEqual: true,
    workerRecoveryEqual: true,
    mismatchCount: 0
  });
  assert.equal(resultValue.browser.independentRunCount, 2);
  assert.equal(resultValue.browser.allProcessesClosed, true);
  assert.equal(resultValue.browser.allProfilesDeleted, true);
  assert.equal(resultValue.browser.totalNetworkRequestCount, 0);
  assert.equal(resultValue.browser.totalConsoleErrorCount, 0);
  assert.equal(resultValue.browser.totalPageErrorCount, 0);
  assert.equal(resultValue.resources.allBoundsSatisfied, true);
  assert.ok(
    resultValue.resources.maximumWasmLinearMemoryBytesObserved <=
      resultValue.resources.registeredMaximumWasmLinearMemoryBytes
  );
  assert.ok(
    resultValue.resources.maximumTotalMsObserved <=
      resultValue.resources.registeredOperationTimeoutMs
  );
  assert.deepEqual(resultValue.claimBoundary, {
    tokenizerSourceParityVerified: true,
    tokenizerBrowserWasmParityVerified: true,
    modelRuntimeVerified: false,
    modelQualityVerified: false,
    releaseAuthorized: false,
    campaignCreditAuthorized: false,
    requiredNextGate: "template2-byte-profile-and-source-parity"
  });
  assert.equal(Object.hasOwn(resultValue, "results"), false);
  assert.equal(resultValue.runs.some((run) => Object.hasOwn(run, "results")), false);
  assert.doesNotMatch(bytes.toString("utf8"), /[A-Z]:\\|TinyRustLM-vnext-private/iu);
});
