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
const repositoryRoot = path.resolve(testsRoot, "../..");

// Exercise the production dispatcher while recording its boundaries without running gates.
function unitGateHarness(argumentsList, failAt = "") {
  const source = fs.readFileSync(path.join(testsRoot, "../tools/run-vnext-unit-test-gate.js"), "utf8");
  const main = source.match(/^async function main\(\) \{[\s\S]*?^\}/mu);
  assert.ok(main, "production unit gate main must exist");
  const calls = [];
  const result = Object.freeze({ verdict: "fixture-pass" });
  const record = (operation, value) => {
    calls.push({ operation, value });
    if (operation === failAt) throw Object.assign(new Error(`fixture-${operation}`), { code: `fixture-${operation}` });
  };
  const bindings = {
    process: { argv: [process.execPath, "run-vnext-unit-test-gate.js", ...argumentsList] },
    repositoryRoot,
    verifySingleSourceAuthority: (options) => record("authority", options.repositoryRoot),
    normalizeEvidenceRoot: (value) => { record("normalize", value); return value; },
    runStandardUnitTests: () => record("standard", undefined),
    runGate: async (value) => { record("release", value); return result; },
    printReleaseResult: (value) => record("print", value),
    fail: (code) => { throw Object.assign(new Error(code), { code }); }
  };
  const run = Function(...Object.keys(bindings), `"use strict";\n${main[0]}\nreturn main;`)(...Object.values(bindings));
  return { run, calls, result };
}

test("CI unit gate invocation runs both partitions with its evidence root", async () => {
  const workflow = fs.readFileSync(path.join(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
  const step = workflow.match(/      - name: Verify offline and distributed MemoryEndpoints sync contracts\r?\n([\s\S]*?)(?=\r?\n      - name:)/u);
  assert.ok(step, "CI unit gate step must exist");
  const invocation = step[1].split(/\r?\n/u).map((line) => line.trim())
    .filter((line) => /^(?:node|npm)\s/u.test(line));
  assert.equal(invocation.length, 1, "CI must run one combined dispatcher");
  const command = invocation[0].match(/^node tinyrustlm\/tools\/run-vnext-unit-test-gate\.js (all) "\$evidenceRoot"$/u);
  assert.ok(command, "CI must pass the evidence root to all, not standard");
  const evidenceRoot = path.join(repositoryRoot, "artifacts", "tests", "fixture evidence root");
  const harness = unitGateHarness([command[1], evidenceRoot]);
  await harness.run();
  assert.deepEqual(harness.calls, [
    { operation: "authority", value: repositoryRoot },
    { operation: "normalize", value: evidenceRoot },
    { operation: "standard", value: undefined },
    { operation: "release", value: evidenceRoot },
    { operation: "print", value: harness.result }
  ]);
});

test("unit gate CLI rejects obsolete standard arguments before running either partition", async () => {
  const evidenceRoot = path.join(repositoryRoot, "artifacts", "tests", "fixture-root");
  for (const argumentsList of [[], ["unknown"], ["standard", evidenceRoot], ["all"],
    ["release-surface"], ["all", evidenceRoot, "extra"], ["release-surface", evidenceRoot, "extra"]]) {
    const harness = unitGateHarness(argumentsList);
    await assert.rejects(harness.run(), { code: "unit_gate_arguments_invalid" }, argumentsList.join(" "));
    assert.deepEqual(harness.calls, [{ operation: "authority", value: repositoryRoot }]);
  }
});

test("unit gate CLI preserves separate standard and release entry points", async () => {
  const standard = unitGateHarness(["standard"]);
  await standard.run();
  assert.deepEqual(standard.calls, [
    { operation: "authority", value: repositoryRoot },
    { operation: "standard", value: undefined }
  ]);
  const evidenceRoot = path.join(repositoryRoot, "artifacts", "tests", "fixture-root");
  const release = unitGateHarness(["release-surface", evidenceRoot]);
  await release.run();
  assert.deepEqual(release.calls, [
    { operation: "authority", value: repositoryRoot },
    { operation: "normalize", value: evidenceRoot },
    { operation: "release", value: evidenceRoot },
    { operation: "print", value: release.result }
  ]);
});

test("unit gate CLI stops before subsequent work after every gate failure", async () => {
  const evidenceRoot = path.join(repositoryRoot, "artifacts", "tests", "fixture-root");
  const operations = ["authority", "normalize", "standard", "release"];
  for (const [index, operation] of operations.entries()) {
    const harness = unitGateHarness(["all", evidenceRoot], operation);
    await assert.rejects(harness.run(), { code: `fixture-${operation}` });
    assert.deepEqual(harness.calls.map((call) => call.operation), operations.slice(0, index + 1));
  }
});

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
