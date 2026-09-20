"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  discoverStandardUnitTestFiles,
  normalizeEvidenceRoot,
  releaseSurfaceTestFile,
  standardTestArguments
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

test("focused browser gates cover current composition execution and keep source admission", () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(testsRoot, "../package.json"), "utf8"));
  const required = [
    "tests/browser-model-admission.test.js",
    "tests/companion-composition-install.test.js",
    "tests/model-runtime-client.test.js",
    "tests/model-runtime-worker.test.js"
  ];
  const standard = discoverStandardUnitTestFiles();
  for (const name of ["test:browser-contract", "test:ui"]) {
    const args = scripts[name].split(/\s+/u);
    assert.deepEqual(args.slice(0, 2), ["node", "--test"]);
    assert.equal(scripts[`pre${name}`], "npm run verify:source-authority");
    for (const file of required) assert.equal(args.includes(file), true, `${name}: ${file}`);
    for (const file of args.filter((value) => value.startsWith("tests/"))) {
      assert.equal(standard.includes(file), true, `${name}: undiscovered suite ${file}`);
    }
    assert.doesNotMatch(scripts[name], /fresh-browser-conversation|browser-round-evidence|run-browser-round/u);
  }
  for (const name of ["run:browser-round", "prerun:browser-round"]) {
    assert.equal(Object.hasOwn(scripts, name), false);
  }
});

test("requires one existing direct absolute evidence root", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-unit-gate-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(normalizeEvidenceRoot(root), path.normalize(root));
  assert.throws(() => normalizeEvidenceRoot("relative"),
    (error) => error?.code === "unit_gate_evidence_root_invalid");
});

test("serializes the canonical standard partition across test files", () => {
  const argumentsList = standardTestArguments([
    "tests/alpha.test.js",
    "tests/beta.test.js"
  ]);
  assert.deepEqual(argumentsList, [
    "--test",
    "--test-reporter=spec",
    "--test-concurrency=1",
    "tests/alpha.test.js",
    "tests/beta.test.js"
  ]);
  assert.equal(Object.isFrozen(argumentsList), true);
});
