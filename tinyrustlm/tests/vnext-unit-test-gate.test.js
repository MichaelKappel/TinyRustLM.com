"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  discoverStandardUnitTestFiles,
  normalizeEvidenceRoot,
  releaseSurfaceTestFile
} = require("../tools/run-vnext-unit-test-gate.js");

const testsRoot = path.resolve(__dirname);

test("discovers every ordinary unit test and delegates only the release surface", () => {
  const expected = fs.readdirSync(testsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() &&
      /^[a-z0-9][a-z0-9.-]*\.test\.js$/u.test(entry.name))
    .map((entry) => `tests/${entry.name}`)
    .filter((entry) => entry !== releaseSurfaceTestFile)
    .sort();
  const actual = discoverStandardUnitTestFiles();
  assert.deepEqual(actual, expected);
  assert.equal(Object.isFrozen(actual), true);
  assert.equal(actual.includes(releaseSurfaceTestFile), false);
  assert.equal(expected.length > 0, true);
});

test("requires one existing direct absolute evidence root", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-unit-gate-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(normalizeEvidenceRoot(root), path.normalize(root));
  assert.throws(() => normalizeEvidenceRoot("relative"),
    (error) => error?.code === "unit_gate_evidence_root_invalid");
});
