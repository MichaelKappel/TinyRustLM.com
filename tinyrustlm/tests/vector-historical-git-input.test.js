"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  gitInputCandidates,
  readGitBlob,
  validateGitInput
} = require("../tools/vector-historical-git-input.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const registrationCommit = "6aec32605d5719f64a833616ec841c53ddb40598";
const sourcePath = "rust/experiments/tinyrustlm-vector-oracle/src/lib.rs";

test("reconstructs raw and deterministic CRLF identities from one Git blob", () => {
  const candidates = gitInputCandidates(
    repositoryRoot,
    registrationCommit,
    sourcePath
  );

  assert.deepEqual(candidates.raw, {
    path: sourcePath,
    bytes: 1268,
    sha256: "dbbaf1a880646e8769f0188e2a79c1467b3912f272eb00325792e1f787342f63"
  });
  assert.notEqual(candidates.crlf, null);
  assert.equal(
    validateGitInput(
      candidates.raw,
      repositoryRoot,
      registrationCommit,
      sourcePath,
      "raw source"
    ),
    "git-blob"
  );
  assert.equal(
    validateGitInput(
      candidates.crlf,
      repositoryRoot,
      registrationCommit,
      sourcePath,
      "CRLF source"
    ),
    "lf-to-crlf-checkout"
  );
});

test("returns detached bytes and fails closed on identity or locator drift", () => {
  const first = readGitBlob(repositoryRoot, registrationCommit, sourcePath);
  const expectedFirstByte = first[0];
  first[0] ^= 0xff;
  const second = readGitBlob(repositoryRoot, registrationCommit, sourcePath);
  assert.equal(second[0], expectedFirstByte);

  const changed = {
    ...gitInputCandidates(repositoryRoot, registrationCommit, sourcePath).raw,
    sha256: "0".repeat(64)
  };
  assert.throws(
    () => validateGitInput(
      changed,
      repositoryRoot,
      registrationCommit,
      sourcePath,
      "changed source"
    ),
    /does not match its historical source revision/u
  );
  assert.throws(
    () => readGitBlob(repositoryRoot, "0".repeat(40), sourcePath),
    /historical Git blob is unavailable/u
  );
  assert.throws(
    () => readGitBlob(repositoryRoot, registrationCommit, "../private"),
    /historical path is unsafe/u
  );
});
