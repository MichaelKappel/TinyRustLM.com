"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const summaryRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-quality-number-domain-defect.v1.json";
const summaryPath = path.join(repositoryRoot, summaryRelativePath);
const revisionPattern = /^[0-9a-f]{40}$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const relativePathPattern = /^[A-Za-z0-9._/-]+$/u;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function git(argumentsList) {
  const result = childProcess.spawnSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: null,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stderr.length, 0);
  return result.stdout;
}

function readSummary() {
  const bytes = fs.readFileSync(summaryPath);
  const value = JSON.parse(bytes.toString("utf8"));
  assert.deepEqual(
    Object.keys(value),
    [
      "schema",
      "defectId",
      "status",
      "createdAtUtc",
      "terminalEvidence",
      "observedFacts",
      "provenCodeDefect",
      "deterministicReproduction",
      "fix",
      "authority",
      "campaignCountersAfterFix",
      "requiredNextGate"
    ]
  );
  assert.equal(bytes.toString("utf8"), `${JSON.stringify(value, null, 2)}\n`);
  return value;
}

function validateFile(reference) {
  assert.match(reference.path, relativePathPattern);
  assert.match(reference.sha256 ?? reference.fileSha256, sha256Pattern);
  const resolved = path.resolve(repositoryRoot, reference.path);
  assert.ok(resolved.startsWith(`${repositoryRoot}${path.sep}`));
  const bytes = fs.readFileSync(resolved);
  assert.equal(bytes.length, reference.bytes);
  assert.equal(sha256(bytes), reference.sha256 ?? reference.fileSha256);
}

test("binds the immutable terminal failure and distinct fixed source", () => {
  const summary = readSummary();
  validateFile(summary.terminalEvidence.attempt);
  validateFile(summary.terminalEvidence.verification);
  validateFile(summary.provenCodeDefect.terminalSource);
  validateFile(summary.fix.terminalV1Preserved);
  validateFile(summary.fix.distinctV2Source);
  validateFile(summary.fix.regressionTest);
  assert.equal(
    summary.provenCodeDefect.terminalSource.sha256,
    summary.fix.terminalV1Preserved.sha256
  );
  assert.notEqual(
    summary.fix.distinctV2Source.sha256,
    summary.fix.terminalV1Preserved.sha256
  );
});

test("preserves the red reproduction and fix commits in order", () => {
  const summary = readSummary();
  const red = summary.deterministicReproduction.redTestCommit;
  const fixed = summary.fix.commit;
  assert.match(red, revisionPattern);
  assert.match(fixed, revisionPattern);
  const ancestry = childProcess.spawnSync(
    "git",
    ["merge-base", "--is-ancestor", red, fixed],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 1024 * 1024
    }
  );
  assert.equal(ancestry.error, undefined);
  assert.equal(ancestry.signal, null);
  assert.equal(ancestry.status, 0);
  assert.equal(ancestry.stderr, "");
  const redSource = git([
    "cat-file",
    "blob",
    `${red}:tinyrustlm/experiments/vector-quantization/portable-affine-u8-benchmark.rs`
  ]).toString("utf8");
  assert.match(redSource, /finite_signed_quality_deltas_are_valid_json_numbers/u);
  assert.match(redSource, /JSON metrics must be finite unit-interval values/u);
  const fixedSource = git([
    "cat-file",
    "blob",
    `${fixed}:tinyrustlm/experiments/vector-quantization/portable-affine-u8-benchmark-v2.rs`
  ]);
  assert.equal(sha256(fixedSource), summary.fix.distinctV2Source.sha256);
});

test("keeps historical uncertainty and every authority boundary explicit", () => {
  const summary = readSummary();
  const interpretation =
    summary.provenCodeDefect.historicalOutcomeInterpretation;
  assert.equal(interpretation.defectNecessarilyPreventsSuccessfulV1QualitySerialization, true);
  assert.equal(interpretation.exactFirstHistoricalPanicSiteProven, false);
  assert.equal(interpretation.rawStderrReconstructedOrClaimed, false);
  assert.equal(interpretation.windowsExitCodeNameClaimed, false);
  assert.ok(Object.values(summary.authority).every((value) => value === false));
  assert.ok(
    Object.values(summary.campaignCountersAfterFix).every((value) => value === 0)
  );
  const text = JSON.stringify(summary);
  assert.doesNotMatch(text, /Authorization|Bearer |[A-Za-z]:\\/u);
});
