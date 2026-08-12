"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  extractTopLevelTestNames,
  releaseSurfaceShards,
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
  assert.equal(new Set(partitionNames).size, 23);
  assert.deepEqual([...partitionNames].sort(), [...names].sort());
  for (const shard of releaseSurfaceShards) {
    const expression = new RegExp(shardPattern(shard), "u");
    assert.deepEqual(names.filter((name) => expression.test(name)).sort(),
      [...shard].sort());
  }
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
