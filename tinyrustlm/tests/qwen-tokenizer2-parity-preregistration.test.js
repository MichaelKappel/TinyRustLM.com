"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildCorpus, canonicalBytes: canonicalCorpusBytes } = require(
  "../tools/qwen-tokenizer2-parity-corpus.js"
);
const {
  compareResultSets,
  executionProfilePath,
  sourceClosureSha256,
  validateExecutionProfile,
  validatePreregistrationFiles,
  validateResultDocument,
  validateVerificationProfile,
  verificationProfilePath,
  writeCreateOnly
} = require("../tools/qwen-tokenizer2-parity-verifier.js");

/** Creates a JSON-compatible mutable copy. */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Builds a structurally complete output without invoking either tokenizer. */
function inertResult(kind, execution, corpus) {
  const profile = execution.profile;
  const implementation = kind === "source-oracle" ? {
    kind,
    name: profile.oracle.implementation,
    version: profile.oracle.version,
    executableSha256: profile.oracle.pythonExecutableSha256,
    sourceIdentitySha256: profile.oracle.wheelSha256
  } : {
    kind,
    name: profile.candidate.implementation,
    version: profile.candidate.version,
    executableSha256: "a".repeat(64),
    sourceIdentitySha256: profile.candidate.sourceClosureSha256
  };
  return {
    schema: "tinyrustlm.qwen_tokenizer2_parity_result.v1",
    implementation,
    preregistration: {
      profileId: profile.profileId,
      profileSha256: execution.sha256
    },
    source: {
      modelId: profile.source.modelId,
      revision: profile.source.revision,
      tokenizerSha256: profile.source.tokenizerSha256
    },
    artifact: clone(profile.artifact),
    corpus: {
      corpusId: profile.corpus.corpusId,
      sha256: profile.corpus.sha256,
      caseCount: profile.corpus.caseCount
    },
    summary: {
      caseCount: corpus.cases.length,
      totalTokenCount: 0,
      maximumTokenCount: 0
    },
    results: corpus.cases.map((entry) => ({
      caseId: entry.caseId,
      tokenIds: [],
      decodeIncludeAll: "",
      decodeSkipSpecial: ""
    }))
  };
}

test("validates both frozen Qwen Tokenizer2 parity preregistrations", () => {
  const profiles = validatePreregistrationFiles();
  assert.equal(
    profiles.execution.sha256,
    "bccc1631c519774ca46d77100ba59dae0d3eb4dcc681cd227f192bf558319466"
  );
  assert.equal(profiles.execution.profile.corpus.caseCount, 2048);
  assert.equal(profiles.execution.profile.execution.requiredOracleRuns, 2);
  assert.equal(profiles.execution.profile.execution.requiredCandidateRuns, 2);
  assert.equal(profiles.verification.profile.execution.mismatchIsFatal, true);
  assert.equal(
    profiles.verification.profile.claimBoundary.modelQualityMayBeClaimed,
    false
  );
});

test("rebuilds an output-free corpus with exact committed bytes", () => {
  const corpus = buildCorpus();
  const committed = fs.readFileSync(
    path.join(__dirname, "../../contracts/vnext/qwen-tokenizer2-parity-cases.v1.json")
  );
  assert.equal(corpus.cases.length, 2048);
  assert.equal(committed.equals(canonicalCorpusBytes(corpus)), true);
  for (const entry of corpus.cases) {
    assert.deepEqual(Object.keys(entry), ["caseId", "category", "text"]);
    assert.equal(Object.hasOwn(entry, "tokenIds"), false);
    assert.equal(Object.hasOwn(entry, "expected"), false);
    assert.equal(Object.hasOwn(entry, "answer"), false);
  }
});

test("rejects execution-profile authority relaxation and unknown fields", () => {
  const profile = validatePreregistrationFiles().execution.profile;

  const authority = clone(profile);
  authority.claimBoundary.modelQualityMayBeClaimed = true;
  assert.throws(
    () => validateExecutionProfile(authority),
    /claim boundary changed/u
  );

  const repair = clone(profile);
  repair.execution.repair = true;
  assert.throws(() => validateExecutionProfile(repair), /execution policy is invalid/u);

  const unknown = clone(profile);
  unknown.compatibilityVersion = 1;
  assert.throws(() => validateExecutionProfile(unknown), /profile fields are invalid/u);
});

test("rejects verification-profile weakening and verifier drift", () => {
  const profiles = validatePreregistrationFiles();

  const mismatch = clone(profiles.verification.profile);
  mismatch.execution.mismatchIsFatal = false;
  assert.throws(
    () => validateVerificationProfile(mismatch, profiles.execution),
    /verification execution is invalid/u
  );

  const outputLeak = clone(profiles.verification.profile);
  outputLeak.receipt.includeTokenIds = true;
  assert.throws(
    () => validateVerificationProfile(outputLeak, profiles.execution),
    /verification receipt is invalid/u
  );

  const verifier = clone(profiles.verification.profile);
  verifier.verifier.scriptSha256 = "f".repeat(64);
  assert.throws(
    () => validateVerificationProfile(verifier, profiles.execution),
    /verification verifier SHA-256 changed/u
  );
});

test("strictly rejects duplicate members and noncanonical profile bytes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qwen-tok2-prereg-"));
  const duplicatePath = path.join(root, "duplicate.json");
  const noncanonicalPath = path.join(root, "noncanonical.json");
  try {
    const original = fs.readFileSync(executionProfilePath, "utf8");
    fs.writeFileSync(duplicatePath,
      original.replace("{", "{\n  \"schema\": \"duplicate\","), "utf8");
    assert.throws(
      () => validatePreregistrationFiles(verificationProfilePath, duplicatePath),
      /duplicate object member/u
    );

    const profile = JSON.parse(original);
    fs.writeFileSync(noncanonicalPath, JSON.stringify(profile), "utf8");
    assert.throws(
      () => validatePreregistrationFiles(verificationProfilePath, noncanonicalPath),
      /execution profile bytes are not canonical/u
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("validates exact result structure without observing comparative output", () => {
  const profiles = validatePreregistrationFiles();
  const corpus = buildCorpus();
  const oracle = inertResult("source-oracle", profiles.execution, corpus);
  const candidate = inertResult("candidate", profiles.execution, corpus);
  assert.equal(
    validateResultDocument(oracle, "source-oracle", profiles.execution, corpus),
    oracle
  );
  assert.equal(
    validateResultDocument(candidate, "candidate", profiles.execution, corpus),
    candidate
  );

  const unknown = clone(candidate);
  unknown.results[0].expectedText = "forbidden";
  assert.throws(
    () => validateResultDocument(
      unknown, "candidate", profiles.execution, corpus
    ),
    /candidate case 0 fields are invalid/u
  );

  const invalidToken = clone(candidate);
  invalidToken.results[0].tokenIds = [-1];
  invalidToken.summary.totalTokenCount = 1;
  invalidToken.summary.maximumTokenCount = 1;
  assert.throws(
    () => validateResultDocument(
      invalidToken, "candidate", profiles.execution, corpus
    ),
    /invalid token ID/u
  );
});

test("reports bounded mismatch metadata without raw output disclosure", () => {
  const oracle = [{
    caseId: "case-1",
    tokenIds: [1, 2],
    decodeIncludeAll: "private oracle text",
    decodeSkipSpecial: "private oracle text"
  }];
  const candidate = [{
    caseId: "case-1",
    tokenIds: [1, 3],
    decodeIncludeAll: "private candidate text",
    decodeSkipSpecial: "private candidate text"
  }];
  const result = compareResultSets(oracle, candidate, 1);
  assert.equal(result.mismatchCount, 1);
  assert.deepEqual(result.mismatches, [{
    caseId: "case-1",
    fields: ["tokenIds", "decodeIncludeAll", "decodeSkipSpecial"]
  }]);
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("recomputes the frozen candidate source closure", () => {
  const candidate = validatePreregistrationFiles().execution.profile.candidate;
  assert.equal(sourceClosureSha256(candidate.sourceClosure),
    candidate.sourceClosureSha256);
});

test("writes receipts once outside source control and refuses replacement", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qwen-tok2-receipt-"));
  const receiptPath = path.join(root, "receipt.json");
  const first = Buffer.from("{\"status\":\"first\"}\n", "utf8");
  const replacement = Buffer.from("{\"status\":\"replacement\"}\n", "utf8");
  try {
    writeCreateOnly(receiptPath, first);
    assert.deepEqual(fs.readFileSync(receiptPath), first);
    assert.throws(
      () => writeCreateOnly(receiptPath, replacement),
      /receipt path already exists/u
    );
    assert.deepEqual(fs.readFileSync(receiptPath), first);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
