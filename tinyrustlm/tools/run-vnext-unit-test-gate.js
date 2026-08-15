"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { runGate } = require("./run-vnext-campaign-release-surface-gate.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const packageRoot = path.join(repositoryRoot, "tinyrustlm");
const testsRoot = path.join(packageRoot, "tests");
const releaseSurfaceTestFile = "tests/vnext-campaign-release-surface.test.js";
const testFilePattern = /^[a-z0-9][a-z0-9.-]*\.test\.js$/u;

function fail(code) {
  const error = new Error("vNext unit-test gate failed");
  error.code = code;
  throw error;
}

function pathIdentity(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function assertDirectDirectory(directoryPath, code) {
  let stat;
  let real;
  try {
    stat = fs.lstatSync(directoryPath);
    real = fs.realpathSync.native(directoryPath);
  } catch (_error) {
    fail(code);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      pathIdentity(path.normalize(real)) !==
        pathIdentity(path.normalize(directoryPath))) {
    fail(code);
  }
}

function normalizeEvidenceRoot(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096 ||
      value.includes("\0") || !path.isAbsolute(value)) {
    fail("unit_gate_evidence_root_invalid");
  }
  const normalized = path.normalize(value);
  if (normalized !== path.resolve(value)) {
    fail("unit_gate_evidence_root_invalid");
  }
  assertDirectDirectory(normalized, "unit_gate_evidence_root_invalid");
  return normalized;
}

function discoverStandardUnitTestFiles() {
  let entries;
  try {
    const stat = fs.lstatSync(testsRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      fail("unit_gate_test_root_invalid");
    }
    entries = fs.readdirSync(testsRoot, { withFileTypes: true });
  } catch (_error) {
    fail("unit_gate_test_root_invalid");
  }
  const matching = entries.filter((entry) => testFilePattern.test(entry.name));
  if (matching.length === 0 || matching.some((entry) =>
    !entry.isFile() || entry.isSymbolicLink())) {
    fail("unit_gate_test_inventory_invalid");
  }
  const relativeFiles = matching.map((entry) => `tests/${entry.name}`).sort();
  if (relativeFiles.filter((entry) => entry === releaseSurfaceTestFile).length !== 1) {
    fail("unit_gate_test_inventory_invalid");
  }
  const standardFiles = relativeFiles.filter((entry) =>
    entry !== releaseSurfaceTestFile);
  if (standardFiles.length + 1 !== relativeFiles.length) {
    fail("unit_gate_test_inventory_invalid");
  }
  return Object.freeze(standardFiles);
}

function runStandardUnitTests() {
  const files = discoverStandardUnitTestFiles();
  const result = childProcess.spawnSync(process.execPath, [
    "--test",
    "--test-reporter=spec",
    ...files
  ], {
    cwd: packageRoot,
    env: process.env,
    shell: false,
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error || result.signal !== null || result.status !== 0) {
    fail("unit_gate_standard_tests_failed");
  }
}

function printReleaseResult(result) {
  process.stdout.write(`${JSON.stringify({
    aggregateByteCount: result.aggregateByteCount,
    aggregateSha256: result.aggregateSha256,
    runId: result.runId,
    testCount: result.testCount,
    verdict: result.verdict
  })}\n`);
}

async function main() {
  const [operation, rawEvidenceRoot, ...extra] = process.argv.slice(2);
  if ((operation !== "all" && operation !== "release-surface") ||
      rawEvidenceRoot === undefined || extra.length !== 0) {
    fail("unit_gate_arguments_invalid");
  }
  const evidenceRoot = normalizeEvidenceRoot(rawEvidenceRoot);
  if (operation === "all") runStandardUnitTests();
  printReleaseResult(await runGate(evidenceRoot));
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.code || "unit_gate_failed"}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  discoverStandardUnitTestFiles,
  normalizeEvidenceRoot,
  releaseSurfaceTestFile
});
