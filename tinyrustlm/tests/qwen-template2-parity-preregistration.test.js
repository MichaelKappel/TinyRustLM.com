"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const { renderCorpus } = require("../tools/qwen-template2-parity-corpus.js");
const {
  Template2VerificationError,
  compareResultDocuments,
  validateArtifact,
  validateCorpus,
  validateExecutionProfile,
  validateVerificationProfile
} = require("../tools/qwen-template2-parity-verifier.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const executionProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-template2-parity-preregistration.v1.json"
);
const verificationProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-template2-parity-verification-preregistration.v1.json"
);
const corpusPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-template2-parity-cases.v1.json"
);
const oraclePath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/qwen-template2-source-oracle.py"
);
const candidatePath = path.join(
  repositoryRoot,
  "rust/crates/tinyrustlm-template2/examples/qwen_template2_parity.rs"
);
const verifierPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/qwen-template2-parity-verifier.js"
);
const observationPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/qwen-template2-parity-observation.js"
);
const publicResultPath = path.join(
  repositoryRoot,
  "tinyrustlm/experiments/qwen3-template2-source-parity-verification-v1.json"
);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function strictDocument(filePath, maximumBytes = 16 * 1024 * 1024) {
  const bytes = fs.readFileSync(filePath);
  const value = parseStrictJson(bytes, {
    maximumBytes,
    maximumDepth: 64,
    maximumTotalEntries: 8 * 1024 * 1024,
    maximumObjectMembers: 4096,
    maximumArrayItems: 65_536,
    maximumStringCodeUnits: maximumBytes,
    maximumTotalStringCodeUnits: maximumBytes,
    maximumNumberCharacters: 32
  });
  return { bytes, value };
}

function clone(value) {
  return structuredClone(value);
}

test("execution and verification preregistrations bind every implementation input", () => {
  const execution = strictDocument(executionProfilePath);
  const verification = strictDocument(verificationProfilePath);
  assert.equal(execution.bytes.length, 6631);
  assert.equal(
    sha256(execution.bytes),
    "c42f7dfb14b6861bd8db47dd1fbca590961ed573c69835556815cbe5cdef1051"
  );
  assert.equal(verification.bytes.length, 5030);
  assert.equal(
    sha256(verification.bytes),
    "c61b9556b30fa3a82085d53a96b1e468fa1fa1a5cd81e7b92f961da1ad473095"
  );
  assert.doesNotThrow(() => validateExecutionProfile(execution.value, execution.bytes));
  assert.doesNotThrow(() => validateVerificationProfile(
    verification.value,
    execution.bytes
  ));
  assert.equal(execution.value.candidate.executableByteLength, 387584);
  assert.equal(
    execution.value.candidate.executableSha256,
    "948d16894ffff63f39c4b5c31e61b7b6f8f004b8161f0bb4e29d40e6681ce51d"
  );
  assert.equal(execution.value.execution.bestOfN, false);
  assert.equal(execution.value.execution.repair, false);
  assert.equal(verification.value.runSet.priorRunReuseAllowed, false);
  assert.equal(verification.value.observationRunner.retryCount, 0);
  assert.deepEqual(verification.value.observationRunner.executionOrder, [
    "source-oracle-1",
    "source-oracle-2",
    "candidate-1",
    "candidate-2",
    "verifier-1"
  ]);
});

test("the committed corpus is deterministic, output-free, unique, and artifact-bound", () => {
  const execution = strictDocument(executionProfilePath);
  const corpus = strictDocument(corpusPath);
  assert.ok(corpus.bytes.equals(renderCorpus()));
  assert.equal(corpus.value.expectedRenderedBytesPresent, false);
  assert.equal(corpus.value.cases.length, 1024);
  assert.equal(new Set(corpus.value.cases.map((entry) => entry.caseId)).size, 1024);
  assert.equal(new Set(corpus.value.cases.map((entry) =>
    JSON.stringify(entry.messages))).size, 1024);
  for (const entry of corpus.value.cases) {
    assert.deepEqual(Object.keys(entry).sort(), ["caseId", "category", "messages"]);
    for (const message of entry.messages) {
      assert.deepEqual(Object.keys(message).sort(), ["content", "role"]);
    }
  }
  const caseKeys = new Set(corpus.value.cases.flatMap((entry) => [
    ...Object.keys(entry),
    ...entry.messages.flatMap((message) => Object.keys(message))
  ]));
  for (const forbidden of [
    "renderedUtf8Hex", "renderedSha256", "expectedRendered", "expectedOutput"
  ]) {
    assert.equal(caseKeys.has(forbidden), false);
  }
  const profile = validateExecutionProfile(execution.value, execution.bytes);
  assert.doesNotThrow(() => validateCorpus(profile));
  assert.deepEqual(validateArtifact(profile), {
    byteLength: 1403,
    sha256: "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8"
  });
});

test("all three executors have the declared isolation and no-repair boundaries", () => {
  const oracle = fs.readFileSync(oraclePath, "utf8");
  const candidate = fs.readFileSync(candidatePath, "utf8");
  const verifier = fs.readFileSync(verifierPath, "utf8");
  const observation = fs.readFileSync(observationPath, "utf8");
  assert.doesNotMatch(oracle,
    /^\s*(?:from|import)\s+(?:socket|subprocess|urllib|http|requests|ctypes)\b/mu);
  assert.doesNotMatch(oracle, /\b(?:os\.system|eval|exec)\s*\(/u);
  assert.match(oracle, /sys\.addaudithook\(audit_hook\)/u);
  assert.match(oracle, /ImmutableSandboxedEnvironment/u);
  assert.match(oracle, /tools=None/u);
  assert.match(oracle, /enable_thinking=False/u);
  assert.doesNotMatch(candidate,
    /\b(?:reqwest|ureq|tokio|hyper)\b/iu);
  assert.match(candidate, /\.create_new\(true\)/u);
  assert.doesNotMatch(verifier,
    /node:(?:child_process|cluster|dgram|dns|http|https|net|tls|vm|worker_threads)/u);
  assert.doesNotMatch(verifier, /\bfetch\s*\(|XMLHttpRequest|WebSocket/u);
  assert.match(observation, /retryCount:\s*0/u);
  assert.doesNotMatch(observation,
    /node:(?:cluster|dgram|dns|http|https|net|tls|vm|worker_threads)/u);
  assert.doesNotMatch(observation, /\bfetch\s*\(|XMLHttpRequest|WebSocket/u);
});

test("malformed observer and verifier invocations fail before creating evidence", () => {
  for (const [script, expected] of [
    [observationPath, "template2-observation-arguments-invalid"],
    [verifierPath, "template2-verifier-arguments-invalid"]
  ]) {
    const result = childProcess.spawnSync(process.execPath, [script], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, new RegExp(`${expected}\\r?\\n$`, "u"));
  }
});

test("the verifier ignores object member order but rejects every semantic mismatch", () => {
  const oracle = {
    source: { modelId: "x", revision: "y", sourceTemplateSha256: "z" },
    artifact: { byteLength: 3, sha256: "a" },
    corpus: { corpusId: "c", sha256: "d", caseCount: 1 },
    summary: { caseCount: 1, totalRenderedBytes: 2, maximumRenderedBytes: 2 },
    results: [{
      caseId: "case-1",
      renderedByteLength: 2,
      renderedSha256: "hash",
      renderedUtf8Hex: "00ff"
    }]
  };
  const reordered = {
    results: [{
      renderedUtf8Hex: "00ff",
      renderedSha256: "hash",
      renderedByteLength: 2,
      caseId: "case-1"
    }],
    summary: { maximumRenderedBytes: 2, totalRenderedBytes: 2, caseCount: 1 },
    corpus: { caseCount: 1, sha256: "d", corpusId: "c" },
    artifact: { sha256: "a", byteLength: 3 },
    source: { sourceTemplateSha256: "z", revision: "y", modelId: "x" }
  };
  assert.deepEqual(compareResultDocuments(oracle, reordered), {
    caseCount: 1,
    totalRenderedBytes: 2,
    maximumRenderedBytes: 2,
    mismatchCount: 0,
    exactCaseOrder: true,
    exactRenderedBytes: true,
    repeatedOracleBytes: true,
    repeatedCandidateBytes: true
  });
  for (const mutate of [
    (value) => { value.results[0].renderedUtf8Hex = "0000"; },
    (value) => { value.results[0].caseId = "case-2"; },
    (value) => { value.summary.totalRenderedBytes = 3; },
    (value) => { value.artifact.sha256 = "b"; },
    (value) => { value.source.revision = "other"; }
  ]) {
    const candidate = clone(reordered);
    mutate(candidate);
    assert.throws(
      () => compareResultDocuments(oracle, candidate),
      (error) => error instanceof Template2VerificationError &&
        error.code === "template2-verifier-parity-mismatch"
    );
  }
});

test("profile drift is terminal before any comparative execution", () => {
  const execution = strictDocument(executionProfilePath);
  const verification = strictDocument(verificationProfilePath);
  const driftedExecution = clone(execution.value);
  driftedExecution.execution.repair = true;
  assert.throws(
    () => validateExecutionProfile(driftedExecution, execution.bytes),
    (error) => error instanceof Template2VerificationError &&
      error.code === "template2-verifier-execution-profile-invalid"
  );
  const driftedVerification = clone(verification.value);
  driftedVerification.observationRunner.retryCount = 1;
  assert.throws(
    () => validateVerificationProfile(driftedVerification, execution.bytes),
    (error) => error instanceof Template2VerificationError &&
      error.code === "template2-verifier-profile-invalid"
  );
  const malformedClosure = clone(verification.value);
  malformedClosure.verifier.sourceClosure[0] = null;
  assert.throws(
    () => validateVerificationProfile(malformedClosure, execution.bytes),
    (error) => error instanceof Template2VerificationError &&
      error.code === "template2-verifier-profile-invalid"
  );
});

test("locks the bounded content-free source-parity result", () => {
  const result = strictDocument(publicResultPath, 1024 * 1024);
  assert.equal(result.bytes.length, 4727);
  assert.equal(
    sha256(result.bytes),
    "c985f3c95e6554425de1743b723009cb92c17246eac4859c2f9feaa0aa5e3fa0"
  );
  assert.equal(result.value.status, "exact-source-native-template-parity-verified");
  assert.equal(result.value.sourceControl.registrationCommit,
    "2693cec9eeff6af991c78d42a0eb9c9fe5716f60");
  assert.equal(result.value.registration.childProcessCount, 5);
  assert.equal(result.value.registration.retryCount, 0);
  assert.equal(result.value.comparison.caseCount, 1024);
  assert.equal(result.value.comparison.mismatchCount, 0);
  assert.equal(result.value.comparison.exactRenderedBytes, true);
  assert.equal(result.value.comparison.repeatedOracleBytes, true);
  assert.equal(result.value.comparison.repeatedCandidateBytes, true);
  assert.equal(result.value.privateEvidence.receiptByteLength, 4206);
  assert.equal(result.value.privateEvidence.receiptSha256,
    "d0a848a0827f536fb69b2d6f19ffb84102b1ff83ac2efed25e564fa9b2810cdb");
  assert.equal(result.value.privateEvidence.messageContentIncludedInPublicResult,
    false);
  assert.equal(result.value.privateEvidence.renderedTextIncludedInPublicResult,
    false);
  assert.equal(result.value.privateEvidence.renderedHexIncludedInPublicResult,
    false);
  assert.equal(result.value.privateEvidence.privateAbsolutePathsIncludedInPublicResult,
    false);
  assert.equal(result.value.claimBoundary.templateSourceParityVerified, true);
  assert.equal(result.value.claimBoundary.templateBrowserWasmParityVerified, false);
  assert.equal(result.value.claimBoundary.modelRuntimeVerified, false);
  assert.equal(result.value.claimBoundary.releaseAuthorized, false);
  assert.equal(result.value.claimBoundary.campaignCreditAuthorized, false);
});
