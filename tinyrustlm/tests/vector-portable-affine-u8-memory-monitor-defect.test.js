"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  productionLineageReader
} = require("../tools/clean-history-lineage.js");
const {
  readGitBlob,
  validateGitInput
} = require("../tools/vector-historical-git-input.js");

const {
  memoryMonitorScript
} = require("../tools/vector-portable-affine-u8-observation.js");
const {
  memoryMonitorContract,
  memoryMonitorScriptV2,
  minimumSamplesIfPostPrepareIsFirstLoopSample
} = require("../tools/vector-portable-affine-u8-memory-monitor-v2.js");
const {
  validateReceiptFile
} = require(
  "../tools/vector-portable-affine-u8-json-domain-v2-verification.js"
);

const repositoryRoot = path.resolve(__dirname, "../..");
const summaryRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-memory-monitor-sample-race-defect.v1.json";
const summaryPath = path.join(repositoryRoot, summaryRelativePath);
const revisionPattern = /^[a-f0-9]{40}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const relativePathPattern =
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readSummary() {
  const bytes = fs.readFileSync(summaryPath);
  const value = JSON.parse(bytes.toString("utf8"));
  assert.deepEqual(Object.keys(value), [
    "schema",
    "defectId",
    "status",
    "createdAtUtc",
    "terminalEvidence",
    "observedFacts",
    "reproducedCodeDefect",
    "deterministicReproduction",
    "fix",
    "authority",
    "campaignCountersAfterFix",
    "requiredNextGate"
  ]);
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

test("binds the immutable terminal monitor failure and independent verifier", () => {
  const summary = readSummary();
  validateFile(summary.terminalEvidence.attempt);
  validateFile(summary.terminalEvidence.verification);
  validateGitInput(
    summary.reproducedCodeDefect.frozenHarnessSource,
    repositoryRoot,
    summary.terminalEvidence.attempt.sourceRevision,
    summary.reproducedCodeDefect.frozenHarnessSource.path,
    "frozen harness source"
  );
  const receipt = validateReceiptFile();
  assert.equal(
    receipt.receipt.receiptId,
    summary.terminalEvidence.verification.receiptId
  );
  assert.equal(
    receipt.receipt.independentSummary.processSummary
      .failedMemoryMonitorStderrSha256,
    summary.terminalEvidence.monitorFailure.stderrSha256
  );
});

test("preserves the red regression and corrected monitor commits in order", () => {
  const summary = readSummary();
  const red = summary.deterministicReproduction.redTestCommit;
  const fixed = summary.fix.commit;
  assert.match(red, revisionPattern);
  assert.match(fixed, revisionPattern);
  assert.equal(productionLineageReader().isAncestor(red, fixed), true);
  const redSource = readGitBlob(
    repositoryRoot,
    red,
    "tinyrustlm/tests/vector-portable-affine-u8-memory-monitor-v2.test.js"
  ).toString("utf8");
  assert.match(redSource, /minimumSamplesIfPostPrepareIsFirstLoopSample/u);
  assert.match(redSource, />= 2/u);
  const fixedTool = readGitBlob(
    repositoryRoot,
    fixed,
    summary.fix.correctedMonitor.path
  );
  const fixedTest = readGitBlob(
    repositoryRoot,
    fixed,
    summary.fix.regressionTest.path
  );
  assert.equal(sha256(fixedTool), summary.fix.correctedMonitor.sha256);
  assert.equal(sha256(fixedTest), summary.fix.regressionTest.sha256);
});

test("proves the generic one-sample race without assigning terminal stderr", () => {
  const summary = readSummary();
  assert.equal(
    minimumSamplesIfPostPrepareIsFirstLoopSample(memoryMonitorScript),
    1
  );
  assert.equal(
    minimumSamplesIfPostPrepareIsFirstLoopSample(memoryMonitorScriptV2),
    2
  );
  assert.deepEqual(summary.fix.correctedScriptContract, memoryMonitorContract);
  assert.equal(
    summary.reproducedCodeDefect.historicalOutcomeInterpretation
      .raceCanProduceTheObservedExitShape,
    true
  );
  assert.equal(
    summary.reproducedCodeDefect.historicalOutcomeInterpretation
      .exactTerminalThrowSiteProven,
    false
  );
  assert.equal(
    summary.reproducedCodeDefect.historicalOutcomeInterpretation
      .rawStderrReconstructedOrClaimed,
    false
  );
  assert.equal(
    summary.reproducedCodeDefect.historicalOutcomeInterpretation
      .terminalRootCauseClaimed,
    false
  );
});

test("keeps every authority and campaign counter at zero", () => {
  const summary = readSummary();
  assert.ok(Object.values(summary.authority).every((value) => value === false));
  assert.ok(
    Object.values(summary.campaignCountersAfterFix)
      .every((value) => value === 0)
  );
  const text = JSON.stringify(summary);
  assert.doesNotMatch(text, /Authorization|Bearer |[A-Za-z]:\\/u);
});
