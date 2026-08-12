"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  extractTopLevelTestNames,
  maximumConcurrentShards,
  releaseSurfaceShards,
  runShardPool,
  shardPattern,
  validateShardPartition
} = require("../tools/run-vnext-campaign-release-surface-gate.js");

const releaseSurfaceTestPath = path.resolve(
  __dirname,
  "vnext-campaign-release-surface.test.js"
);

test("freezes one exhaustive release-surface gate partition", () => {
  const source = fs.readFileSync(releaseSurfaceTestPath, "utf8");
  const result = validateShardPartition(source);
  const names = extractTopLevelTestNames(source);
  const partitionNames = releaseSurfaceShards.flat();

  assert.deepEqual(result, { shardCount: 6, testCount: 23 });
  assert.equal(maximumConcurrentShards, 1);
  assert.equal(new Set(partitionNames).size, 23);
  assert.deepEqual([...partitionNames].sort(), [...names].sort());
  for (const shard of releaseSurfaceShards) {
    const expression = new RegExp(shardPattern(shard), "u");
    assert.deepEqual(names.filter((name) => expression.test(name)).sort(),
      [...shard].sort());
  }
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
