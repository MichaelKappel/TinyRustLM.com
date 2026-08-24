"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  classifyExactIdPrefix
} = require("../tools/vnext-exact-id-prefix.js");

function id(index) {
  return `sha256:${index.toString(16).padStart(64, "0")}`;
}

test("classifies every exact durable prefix from zero through 1024", () => {
  const base = [id(2_000), id(2_001), id(2_002)];
  const descendants = Array.from({ length: 1_024 }, (_entry, index) => id(index));

  for (let length = 0; length <= descendants.length; length += 1) {
    const current = [...base, ...descendants.slice(0, length)].sort();
    assert.equal(classifyExactIdPrefix(current, base, descendants), length,
      `prefix ${length}`);
  }
});

test("rejects non-prefix, foreign, duplicate, and missing-base membership", () => {
  const base = [id(2_000), id(2_001)];
  const descendants = [id(0), id(1), id(2), id(3)];

  assert.equal(classifyExactIdPrefix([...base, descendants[1]].sort(),
    base, descendants), -1);
  assert.equal(classifyExactIdPrefix([...base, id(3_000)].sort(),
    base, descendants), -1);
  assert.equal(classifyExactIdPrefix([base[0], descendants[0]].sort(),
    base, descendants), -1);
  assert.equal(classifyExactIdPrefix([...base, descendants[0], descendants[0]].sort(),
    base, descendants), -1);
  assert.equal(classifyExactIdPrefix([...base, descendants[0]].sort(),
    base, [descendants[0], descendants[0]]), -1);
  assert.equal(classifyExactIdPrefix([...base].sort(),
    base, [base[0], descendants[0]]), -1);
  assert.equal(classifyExactIdPrefix([...base].sort(),
    [base[0], base[0]], descendants), -1);
});

test("uses cached membership and bounded batches in the release surface", () => {
  const source = fs.readFileSync(path.resolve(__dirname,
    "../tools/vnext-campaign-release-surface.js"), "utf8");
  assert.doesNotMatch(source,
    /receiptStore\.rebuild\(\)|subjectStore\.rebuild\(\)/u);
  assert.doesNotMatch(source,
    /persistence\.push\(receiptStore\.put\(sequence\[index\]\.bytes\)\)/u);
  assert.doesNotMatch(source,
    /subjectPersistence\.push\(subjectStore\.put\(claims\[index\]\.claimBytes\)\)/u);
  assert.match(source,
    /receiptStore\.putMany\(remaining\.map\(\(entry\) => entry\.bytes\)\)/u);
  assert.match(source,
    /subjectStore\.putMany\([\s\S]*remainingClaims\.map/u);
});
