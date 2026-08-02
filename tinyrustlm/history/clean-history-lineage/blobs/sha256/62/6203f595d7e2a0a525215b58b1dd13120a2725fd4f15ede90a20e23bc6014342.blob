"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  defaultPath,
  expectedManifestSha256,
  expectedSectionHashes,
  experimentId,
  phaseContract,
  schema,
  validateManifest,
  validateManifestFile
} = require(
  "../tools/vector-portable-affine-u8-successor-preregistration.js"
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function manifest() {
  return clone(validateManifestFile(defaultPath).manifest);
}

test("validates a distinct full successor with frozen subject contracts", () => {
  const result = validateManifestFile(defaultPath);
  assert.equal(result.manifest.schema, schema);
  assert.equal(result.manifest.experimentId, experimentId);
  assert.deepEqual(result.manifest.frozenSubject.sectionHashes, expectedSectionHashes);
  assert.deepEqual(result.manifest.fullExecution.phaseOrder, phaseContract);
  assert.equal(result.manifest.fullExecution.maximumBenchmarkProcessCountOnCompleteRun, 77);
  assert.equal(result.manifest.fullExecution.qualityProcessCount, 1);
  assert.equal(result.sha256, expectedManifestSha256);
});

test("registration precedes every planned successor artifact", () => {
  const result = validateManifestFile(defaultPath);
  if (result.registrationCommit !== null) {
    assert.match(result.registrationCommit, /^[a-f0-9]{40}$/u);
    return;
  }
  const root = path.resolve(__dirname, "../..");
  for (const [key, relativePath] of Object.entries(
    result.manifest.plannedArtifacts
  )) {
    if (!(key.endsWith("Path") || key === "attemptDirectory")) continue;
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, relativePath);
  }
});

test("rejects relabeling the terminal chain as a retry", () => {
  const retry = manifest();
  retry.successorBoundary.newAttemptAppendedToTerminalExperiment = true;
  assert.throws(() => validateManifest(retry), /successor boundary is invalid/u);

  const terminal = manifest();
  terminal.lineage.terminalSubjectExperiment.sameExperimentRetryAllowed = true;
  assert.throws(() => validateManifest(terminal), /terminal subject boundary is invalid/u);

  const diagnostic = manifest();
  diagnostic.lineage.terminalDiagnostic.sameDiagnosticRetryAllowed = true;
  assert.throws(
    () => validateManifest(diagnostic),
    /terminal diagnostic boundary is invalid/u
  );
});

test("rejects algorithm, corpus, threshold, or process-contract drift", () => {
  for (const key of [
    "sameBenchmarkSubjectBytesRequired",
    "sameRetrievalImplementationBytesRequired",
    "sameCorpusAndSelectionRequired",
    "sameThresholdsRequired",
    "sameProcessContractRequired"
  ]) {
    const changed = manifest();
    changed.successorBoundary[key] = false;
    assert.throws(() => validateManifest(changed), /successor boundary is invalid/u, key);
  }
});

test("rejects setup before pending intent and full-suite weakening", () => {
  const pending = manifest();
  pending.fullExecution.pendingIntentWrittenBeforeSetup = false;
  assert.throws(() => validateManifest(pending), /full execution boundary is invalid/u);

  const quality = manifest();
  quality.fullExecution.qualityProcessCount = 2;
  assert.throws(() => validateManifest(quality), /full execution boundary is invalid/u);

  const performance = manifest();
  performance.fullExecution.phaseOrder[7].benchmarkProcessCount = 0;
  assert.throws(() => validateManifest(performance), /successor phase order is invalid/u);

  const repair = manifest();
  repair.fullExecution.outputRepairAllowed = true;
  assert.throws(() => validateManifest(repair), /full execution boundary is invalid/u);
});

test("rejects outcome retries, overwrite, and pending removal before durable attempt", () => {
  const quality = manifest();
  quality.attemptPolicy.qualityProcessFailureMayBeRetried = true;
  assert.throws(() => validateManifest(quality), /attempt policy is invalid/u);

  const performance = manifest();
  performance.attemptPolicy.performanceOutcomeFailureMayBeRetried = true;
  assert.throws(() => validateManifest(performance), /attempt policy is invalid/u);

  const overwrite = manifest();
  overwrite.attemptPolicy.attemptsMayBeOverwritten = true;
  assert.throws(() => validateManifest(overwrite), /attempt policy is invalid/u);

  const journal = manifest();
  journal.attemptPolicy.pendingJournalMayBeRemovedOnlyAfterAttemptCommitAndReopen = false;
  assert.throws(() => validateManifest(journal), /attempt policy is invalid/u);
});

test("rejects private evidence and every pre-verification authority claim", () => {
  const raw = manifest();
  raw.evidencePolicy.rawStdoutAllowed = true;
  assert.throws(() => validateManifest(raw), /evidence policy is invalid/u);

  const pathDisclosure = manifest();
  pathDisclosure.evidencePolicy.privateAbsolutePathsAllowed = true;
  assert.throws(() => validateManifest(pathDisclosure), /evidence policy is invalid/u);

  for (const key of Object.keys(manifest().authority.beforeVerifiedPass)) {
    const claim = manifest();
    claim.authority.beforeVerifiedPass[key] = true;
    assert.throws(
      () => validateManifest(claim),
      /pre-verification authority must be entirely false/u,
      key
    );
  }
});

test("rejects unknown fields and frozen-contract hash drift", () => {
  const unknown = manifest();
  unknown.legacyCompatibility = true;
  assert.throws(() => validateManifest(unknown), /manifest fields are invalid/u);

  const section = manifest();
  section.frozenSubject.sectionHashes[4].sha256 = "0".repeat(64);
  assert.throws(() => validateManifest(section), /subject section hashes is invalid/u);

  const input = manifest();
  input.frozenSubject.criticalInputs[6].sha256 = "0".repeat(64);
  assert.throws(() => validateManifest(input), /subject critical inputs is invalid/u);
});
