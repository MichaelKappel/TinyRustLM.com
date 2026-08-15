"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  buildChildEnvironment,
  childArguments,
  deriveShardObservation,
  extractTopLevelTestNames,
  gateProfileId,
  gateProfileSha256,
  maximumConcurrentShards,
  releaseSurfaceShards,
  runShardPool,
  shardPattern,
  validateShardPartition
} = require("../tools/run-vnext-campaign-release-surface-gate.js");
const {
  fixtureProfiles,
  secretAttestationTest,
  unsafeChangelogTest
} = require("./helpers/vnext-campaign-release-surface-test-custody.js");

const releaseSurfaceTestPath = path.resolve(
  __dirname,
  "vnext-campaign-release-surface.test.js"
);

function passingSpecOutput(names, overrides = {}) {
  const summary = {
    cancelled: 0,
    fail: 0,
    pass: names.length,
    skipped: 0,
    tests: names.length,
    todo: 0,
    ...overrides
  };
  return Buffer.from([
    ...names.map((name, index) => `✔ ${name} (${index + 1}.25ms)`),
    `ℹ tests ${summary.tests}`,
    "ℹ suites 0",
    `ℹ pass ${summary.pass}`,
    `ℹ fail ${summary.fail}`,
    `ℹ cancelled ${summary.cancelled}`,
    `ℹ skipped ${summary.skipped}`,
    `ℹ todo ${summary.todo}`,
    "ℹ duration_ms 12.5",
    ""
  ].join("\n"), "utf8");
}

const successfulTerminal = Object.freeze({
  exitCode: 0,
  logWriteFailed: false,
  outputLimitExceeded: false,
  signal: null,
  spawnFailed: false,
  timedOut: false
});

test("freezes one exhaustive release-surface gate partition", () => {
  const source = fs.readFileSync(releaseSurfaceTestPath, "utf8");
  const result = validateShardPartition(source);
  const names = extractTopLevelTestNames(source);
  const partitionNames = releaseSurfaceShards.flat();

  assert.deepEqual(result, { shardCount: 8, testCount: 23 });
  assert.equal(gateProfileId,
    "tinyrustlm.vnext.campaign-release-surface-gate.v1");
  assert.equal(gateProfileSha256,
    "aaf94b86be0bba757d4dc8743f810f8801b4389a3c388dda4cf23090c43011a1");
  assert.equal(maximumConcurrentShards, 1);
  assert.equal(new Set(partitionNames).size, 23);
  assert.deepEqual([...partitionNames].sort(), [...names].sort());
  for (const shard of releaseSurfaceShards) {
    const expression = new RegExp(shardPattern(shard), "u");
    assert.deepEqual(names.filter((name) => expression.test(name)).sort(),
      [...shard].sort());
  }
});

test("launches every shard through one exact inherited-pipe custody profile", () => {
  for (const names of releaseSurfaceShards) {
    const argumentsList = childArguments(names);
    assert.equal(argumentsList[0],
      "tinyrustlm/tests/helpers/vnext-campaign-release-surface-launcher.js");
    assert.equal(argumentsList[1], names.includes(secretAttestationTest)
      ? fixtureProfiles.secretAttestation
      : names.includes(unsafeChangelogTest)
        ? fixtureProfiles.unsafeChangelog
        : fixtureProfiles.empty);
    assert.deepEqual(argumentsList.slice(2), [
      "--test",
      "--test-isolation=none",
      "--test-reporter=spec",
      `--test-name-pattern=${shardPattern(names)}`,
      "tinyrustlm/tests/vnext-campaign-release-surface.test.js"
    ]);
    if (argumentsList[1] !== fixtureProfiles.empty) {
      assert.equal(names.length, 1);
    }
  }
});

test("cuts the package entry point to the evidence-root run operation", () => {
  const packageValue = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../package.json"),
    "utf8"
  ));
  assert.equal(
    packageValue.scripts["test:vnext-campaign-release-surface"],
    "node tools/run-vnext-unit-test-gate.js release-surface"
  );
  assert.equal(packageValue.scripts["test:unit"],
    "node tools/run-vnext-unit-test-gate.js all");
  assert.equal(packageValue.engines.node, ">=24.0.0");
});

test("derives a pass only from exact terminal output", () => {
  const names = releaseSurfaceShards[0];
  const result = deriveShardObservation(
    passingSpecOutput(names),
    Buffer.alloc(0),
    successfulTerminal,
    names
  );

  assert.deepEqual(result, {
    failureCode: null,
    observedTestNames: [...names],
    summary: {
      cancelled: 0,
      fail: 0,
      pass: names.length,
      skipped: 0,
      tests: names.length,
      todo: 0
    },
    verdict: "pass"
  });
});

test("rejects incomplete duplicate skipped and stderr-bearing output", () => {
  const names = releaseSurfaceShards[0];
  const incomplete = deriveShardObservation(
    passingSpecOutput(names.slice(0, -1)),
    Buffer.alloc(0),
    successfulTerminal,
    names
  );
  assert.equal(incomplete.failureCode, "child_output_invalid");
  assert.equal(incomplete.verdict, "fail");

  const duplicate = deriveShardObservation(
    passingSpecOutput([names[0], names[0], ...names.slice(2)]),
    Buffer.alloc(0),
    successfulTerminal,
    names
  );
  assert.equal(duplicate.failureCode, "child_output_invalid");

  const skipped = deriveShardObservation(
    passingSpecOutput(names, { pass: names.length - 1, skipped: 1 }),
    Buffer.alloc(0),
    successfulTerminal,
    names
  );
  assert.equal(skipped.failureCode, "child_output_invalid");

  const stderr = deriveShardObservation(
    passingSpecOutput(names),
    Buffer.from("warning\n", "utf8"),
    successfulTerminal,
    names
  );
  assert.equal(stderr.failureCode, "child_stderr_nonempty");

  const contradictoryFailure = deriveShardObservation(
    Buffer.from(
      passingSpecOutput(names).toString("utf8").replace(
        "ℹ tests",
        "✖ hidden contradiction (1ms)\nℹ tests"
      ),
      "utf8"
    ),
    Buffer.alloc(0),
    successfulTerminal,
    names
  );
  assert.equal(contradictoryFailure.failureCode, "child_output_invalid");
});

test("gives bounded terminal failures precedence over attractive output", () => {
  const names = releaseSurfaceShards[0];
  const stdout = passingSpecOutput(names);
  const cases = [
    [{ ...successfulTerminal, outputLimitExceeded: true }, "child_output_limit"],
    [{ ...successfulTerminal, logWriteFailed: true }, "child_log_write_failed"],
    [{ ...successfulTerminal, timedOut: true }, "child_timeout"],
    [{ ...successfulTerminal, spawnFailed: true }, "child_spawn_failed"],
    [{ ...successfulTerminal, signal: "SIGKILL" }, "child_signal"],
    [{ ...successfulTerminal, exitCode: 9 }, "child_exit_nonzero"]
  ];
  for (const [terminal, failureCode] of cases) {
    const result = deriveShardObservation(
      stdout,
      Buffer.alloc(0),
      Object.freeze(terminal),
      names
    );
    assert.equal(result.failureCode, failureCode);
    assert.equal(result.verdict, "fail");
  }
});

test("projects only frozen non-secret child environment bindings", () => {
  const first = buildChildEnvironment({
    CARGO_TARGET_DIR: "D:\\owned-target",
    PATH: "C:\\tools",
    SECRET_TOKEN: "must-not-cross"
  });
  const second = buildChildEnvironment({
    CARGO_TARGET_DIR: "D:\\owned-target",
    PATH: "C:\\tools",
    SECRET_TOKEN: "different-secret"
  });

  assert.deepEqual(first, second);
  assert.equal(Object.hasOwn(first.environment, "SECRET_TOKEN"), false);
  assert.equal(first.environment.CARGO_NET_OFFLINE, "true");
  assert.equal(first.environment.FORCE_COLOR, "0");
  assert.equal(first.environment.TZ, "UTC");
  assert.equal(JSON.stringify(first.bindings).includes("must-not-cross"), false);
  assert.equal(JSON.stringify(first.bindings).includes("D:\\owned-target"), false);
  assert.match(first.bindings.find((entry) =>
    entry.name === "CARGO_TARGET_DIR").sha256, /^[a-f0-9]{64}$/u);
});

test("bounds shard execution and preserves complete index order", async () => {
  const items = ["zero", "one", "two", "three", "four"];
  let active = 0;
  let observedMaximum = 0;
  const started = [];
  const results = await runShardPool(items, 2, async (item, index) => {
    active += 1;
    observedMaximum = Math.max(observedMaximum, active);
    started.push(index);
    await new Promise((resolve) => setTimeout(resolve, index % 2 === 0 ? 8 : 1));
    active -= 1;
    return `${index}:${item}`;
  });

  assert.equal(observedMaximum, 2);
  assert.deepEqual([...started].sort((left, right) => left - right), [0, 1, 2, 3, 4]);
  assert.deepEqual(results, ["0:zero", "1:one", "2:two", "3:three", "4:four"]);
});

test("rejects invalid shard pool configuration", async () => {
  const worker = async () => "unused";
  await assert.rejects(runShardPool([], 1, worker), TypeError);
  await assert.rejects(runShardPool(["one"], 0, worker), TypeError);
  await assert.rejects(runShardPool(["one"], 2, worker), TypeError);
  await assert.rejects(runShardPool(["one"], 1, null), TypeError);
});

test("rejects missing duplicate and unassigned release-surface tests", () => {
  const source = [
    'test("alpha", () => {});',
    'test("beta", () => {});'
  ].join("\n");
  assert.throws(() => validateShardPartition(source, [["alpha"]]),
    /partition drift/u);
  assert.throws(() => validateShardPartition(source, [["alpha", "alpha", "beta"]]),
    /duplicate release gate test name/u);
  assert.throws(() => validateShardPartition(source, [["alpha", "beta", "gamma"]]),
    /partition drift/u);
  assert.throws(() => validateShardPartition(
    `${source}\ntest("beta", () => {});`,
    [["alpha", "beta"]]
  ), /duplicate top-level test names/u);
});
