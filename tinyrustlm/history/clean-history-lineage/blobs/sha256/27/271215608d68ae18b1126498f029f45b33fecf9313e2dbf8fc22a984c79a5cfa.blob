"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  defaultPath,
  diagnosticId,
  expectedManifestSha256,
  expectedStageNames,
  schema,
  validateManifest,
  validateManifestFile
} = require(
  "../tools/vector-portable-affine-u8-quality-diagnostic-preregistration.js"
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalManifest() {
  return clone(validateManifestFile(defaultPath).manifest);
}

test("validates a frozen non-promotional diagnostic after a terminal experiment", () => {
  const result = validateManifestFile(defaultPath);
  assert.equal(result.manifest.schema, schema);
  assert.equal(result.manifest.diagnosticId, diagnosticId);
  assert.equal(result.manifest.purpose.originalExperimentRemainsTerminal, true);
  assert.equal(result.manifest.purpose.sameExperimentRetryAllowed, false);
  assert.equal(result.manifest.diagnosticExecution.maximumDiagnosticProcessCount, 1);
  assert.equal(result.manifest.diagnosticExecution.maximumDiagnosticAttemptCount, 1);
  assert.deepEqual(
    result.manifest.orderedDiagnosticStages.map((stage) => stage.stage),
    expectedStageNames
  );
  assert.equal(result.sha256, expectedManifestSha256);
});

test("registration precedes runner, result, verifier, and verification material", () => {
  const result = validateManifestFile(defaultPath);
  if (result.registrationCommit === null) {
    const root = path.resolve(__dirname, "../..");
    for (const relativePath of [
      result.manifest.registrationBoundary.diagnosticRunnerPath,
      result.manifest.registrationBoundary.diagnosticAttemptDirectory,
      result.manifest.registrationBoundary.diagnosticVerifierPath,
      result.manifest.registrationBoundary.diagnosticVerificationPath
    ]) {
      assert.equal(fs.existsSync(path.join(root, relativePath)), false, relativePath);
    }
    return;
  }
  assert.match(result.registrationCommit, /^[a-f0-9]{40}$/u);
});

test("rejects reopening, retrying, or relabeling the terminal experiment", () => {
  const reopen = canonicalManifest();
  reopen.purpose.originalExperimentRemainsTerminal = false;
  assert.throws(() => validateManifest(reopen), /purpose boundary is invalid/u);

  const retry = canonicalManifest();
  retry.purpose.sameExperimentRetryAllowed = true;
  assert.throws(() => validateManifest(retry), /purpose boundary is invalid/u);

  const relabel = canonicalManifest();
  relabel.purpose.diagnosticIsAnExperimentRetry = true;
  assert.throws(() => validateManifest(relabel), /purpose boundary is invalid/u);
});

test("rejects a second process, retry, best-of-N, or outcome-mode expansion", () => {
  const second = canonicalManifest();
  second.diagnosticExecution.maximumDiagnosticProcessCount = 2;
  assert.throws(() => validateManifest(second), /diagnostic execution boundary is invalid/u);

  const retry = canonicalManifest();
  retry.diagnosticExecution.retryAllowed = true;
  assert.throws(() => validateManifest(retry), /diagnostic execution boundary is invalid/u);

  const bestOf = canonicalManifest();
  bestOf.diagnosticExecution.bestOfNAllowed = true;
  assert.throws(() => validateManifest(bestOf), /diagnostic execution boundary is invalid/u);

  const performance = canonicalManifest();
  performance.diagnosticExecution.performanceProcessAllowed = true;
  assert.throws(
    () => validateManifest(performance),
    /diagnostic execution boundary is invalid/u
  );
});

test("rejects stage reordering and threshold evaluation", () => {
  const order = canonicalManifest();
  [order.orderedDiagnosticStages[2], order.orderedDiagnosticStages[3]] = [
    order.orderedDiagnosticStages[3], order.orderedDiagnosticStages[2]
  ];
  assert.throws(() => validateManifest(order), /diagnostic stage 2 is invalid/u);

  const threshold = canonicalManifest();
  threshold.diagnosticExecution.thresholdEvaluationAllowed = true;
  assert.throws(
    () => validateManifest(threshold),
    /diagnostic execution boundary is invalid/u
  );
});

test("rejects raw output, parsed metrics, private paths, and overwrite authority", () => {
  const stdout = canonicalManifest();
  stdout.resultContract.rawStdoutAllowed = true;
  assert.throws(() => validateManifest(stdout), /diagnostic result contract is invalid/u);

  const metrics = canonicalManifest();
  metrics.resultContract.parsedQualityMetricsAllowed = true;
  assert.throws(() => validateManifest(metrics), /diagnostic result contract is invalid/u);

  const paths = canonicalManifest();
  paths.resultContract.privatePathsAllowed = true;
  assert.throws(() => validateManifest(paths), /diagnostic result contract is invalid/u);

  const overwrite = canonicalManifest();
  overwrite.resultContract.attemptMayBeOverwritten = true;
  assert.throws(() => validateManifest(overwrite), /diagnostic result contract is invalid/u);
});

test("rejects every form of experiment, product, training, release, or counter authority", () => {
  for (const key of Object.keys(canonicalManifest().authority)) {
    const manifest = canonicalManifest();
    manifest.authority[key] = true;
    assert.throws(
      () => validateManifest(manifest),
      /diagnostic authority must be entirely false/u,
      key
    );
  }
});

test("rejects frozen input drift, unknown fields, private text, and noncanonical bytes", () => {
  const input = canonicalManifest();
  input.frozenInputClosure.criticalInputs[0].sha256 = "0".repeat(64);
  assert.throws(() => validateManifest(input), /critical input closure is invalid/u);

  const unknown = canonicalManifest();
  unknown.legacyCompatibility = true;
  assert.throws(() => validateManifest(unknown), /manifest fields are invalid/u);

  const privateText = canonicalManifest();
  privateText.requiredNextGate = "Read C:\\Users\\Private\\secret.txt";
  assert.throws(() => validateManifest(privateText), /private or secret text/u);

  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "tinyrustlm-affine-u8-diagnostic-prereg-")
  );
  const filePath = path.join(directory, "manifest.json");
  try {
    fs.writeFileSync(
      filePath,
      `${JSON.stringify(canonicalManifest(), null, 2)}\n\n`,
      "utf8"
    );
    assert.throws(
      () => validateManifestFile(filePath),
      /manifest bytes are not canonical pretty JSON/u
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
