"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createRegisteredGitTree } = require(
  "./helpers/registered-git-tree.js"
);
const registeredTree = createRegisteredGitTree({
  profilePath:
    "contracts/vnext/qwen-tokenizer2-parity-verification-preregistration.v2.json",
  requiredPaths: [
    "Cargo.lock",
    "Cargo.toml",
    "contracts/vnext/qwen-tokenizer2-parity-cases.v1.json",
    "contracts/vnext/qwen-tokenizer2-parity-preregistration.v1.json",
    "contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json",
    "rust/crates/tinyrustlm-tokenizer2/Cargo.toml",
    "rust/crates/tinyrustlm-tokenizer2/examples/qwen_tokenizer2_parity.rs",
    "rust/crates/tinyrustlm-tokenizer2/src/format.rs",
    "rust/crates/tinyrustlm-tokenizer2/src/lib.rs",
    "rust/crates/tinyrustlm-tokenizer2/src/runtime.rs",
    "tinyrustlm/tools/qwen-tokenizer2-parity-corpus.js",
    "tinyrustlm/tools/qwen-tokenizer2-parity-verifier-v2.js",
    "tinyrustlm/tools/qwen-tokenizer2-source-oracle.py",
    "tinyrustlm/tools/strict-json.js"
  ]
});
test.after(() => registeredTree.dispose());

const { buildCorpus } = registeredTree.requireModule(
  "tinyrustlm/tools/qwen-tokenizer2-parity-corpus.js"
);
const {
  canonicalJsonBytes,
  validatePreregistrationFiles,
  validateResultDocument,
  validateRunSetPaths,
  verificationProfilePath
} = registeredTree.requireModule(
  "tinyrustlm/tools/qwen-tokenizer2-parity-verifier-v2.js"
);

/** Computes lowercase SHA-256 for exact evidence bytes. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Creates a JSON-compatible mutable copy. */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Reverses every object member order while preserving every array order. */
function reverseObjectMembers(value) {
  if (Array.isArray(value)) return value.map(reverseObjectMembers);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).reverse()
      .map(([key, child]) => [key, reverseObjectMembers(child)]));
  }
  return value;
}

/** Builds a complete noncomparative output fixture. */
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
    executableSha256:
      "1ee0339cecd32cf5651c295b3ead0ff9c612be42fa80bf42e43686804ac480fe",
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

/** Creates the four registered result files under one named run root. */
function makeRunSet(parent, directoryName) {
  const root = path.join(parent, directoryName);
  fs.mkdirSync(root);
  const names = [
    "oracle-run-1.json",
    "oracle-run-2.json",
    "candidate-run-1.json",
    "candidate-run-2.json"
  ];
  for (const name of names) fs.writeFileSync(path.join(root, name), "{}\n", "utf8");
  return {
    oracleRun1: path.join(root, names[0]),
    oracleRun2: path.join(root, names[1]),
    candidateRun1: path.join(root, names[2]),
    candidateRun2: path.join(root, names[3]),
    receiptPath: path.join(root, "parity-verification-receipt.v2.json")
  };
}

test("validates the append-only v2 preregistration and frozen v1 failure", () => {
  assert.equal(
    registeredTree.registrationCommit,
    "6e653482bc551d17f50ab2cf676236bceb139e42"
  );
  assert.equal(
    registeredTree.registrationParentCommit,
    "bd21df3e080085ea9ceedfb065ef51f0d1b09ac5"
  );
  const profiles = validatePreregistrationFiles();
  assert.equal(profiles.verification.sha256,
    "c02523a654c95007b9169bcd4c835b4283f9c7459796d8a943cc4ed0381242b3");
  assert.equal(profiles.verification.profile.predecessorFailure.status,
    "terminal-verifier-defect-no-parity-decision");
  assert.equal(profiles.verification.profile.predecessorFailure.receiptCreated, false);
  assert.equal(
    profiles.verification.profile.predecessorFailure.excludedFromV2Comparison,
    true
  );
  assert.equal(profiles.verification.profile.runSet.priorRunReuseAllowed, false);
  const bytes = fs.readFileSync(verificationProfilePath);
  assert.equal(bytes.equals(canonicalJsonBytes(profiles.verification.profile)), true);
});

test("treats JSON object member order as nonsemantic at every result depth", () => {
  const profiles = validatePreregistrationFiles();
  const corpus = buildCorpus();
  for (const kind of ["source-oracle", "candidate"]) {
    const reordered = reverseObjectMembers(inertResult(kind, profiles.execution, corpus));
    assert.equal(
      validateResultDocument(reordered, kind, profiles.execution, corpus),
      reordered
    );
  }
});

test("continues to treat array order and primitive identity as semantic", () => {
  const profiles = validatePreregistrationFiles();
  const corpus = buildCorpus();
  const candidate = inertResult("candidate", profiles.execution, corpus);
  [candidate.results[0], candidate.results[1]] =
    [candidate.results[1], candidate.results[0]];
  assert.throws(
    () => validateResultDocument(candidate, "candidate", profiles.execution, corpus),
    /candidate case order is invalid/u
  );

  const wrongIdentity = inertResult("candidate", profiles.execution, corpus);
  wrongIdentity.implementation.name = "different-implementation";
  assert.throws(
    () => validateResultDocument(
      wrongIdentity,
      "candidate",
      profiles.execution,
      corpus
    ),
    /candidate implementation identity is invalid/u
  );
});

test("binds v2 inputs and receipt to the registered new run directory", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "qwen-tok2-v2-paths-"));
  try {
    const profile = validatePreregistrationFiles().verification.profile;
    const valid = makeRunSet(parent, profile.runSet.outputDirectoryName);
    assert.doesNotThrow(() => validateRunSetPaths(valid, profile));

    const predecessor = makeRunSet(parent,
      profile.predecessorFailure.attemptId);
    assert.throws(
      () => validateRunSetPaths(predecessor, profile),
      /v2 run directory identity is invalid/u
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("retains the exact v1 verifier and profiles as immutable failure evidence", () => {
  const repositoryRoot = path.resolve(__dirname, "../..");
  const identities = new Map([
    ["contracts/vnext/qwen-tokenizer2-parity-preregistration.v1.json",
      "bccc1631c519774ca46d77100ba59dae0d3eb4dcc681cd227f192bf558319466"],
    ["contracts/vnext/qwen-tokenizer2-parity-verification-preregistration.v1.json",
      "cc1472a7531095323dc1fe2fc2bb878bedfff4cc2cc5b5651f129c4800b0ed05"],
    ["tinyrustlm/tools/qwen-tokenizer2-parity-verifier.js",
      "67791ba375cc8be2b84f1985eea42a810e4dca4edcc91fb0a9bd9e91ec979173"]
  ]);
  for (const [relativePath, expected] of identities) {
    assert.equal(sha256(fs.readFileSync(path.join(repositoryRoot, relativePath))), expected);
  }
});
