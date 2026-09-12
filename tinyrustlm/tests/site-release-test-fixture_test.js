"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { temporaryDirectory } = require("./site-release-test-fixture.js");

test("fixture output is confined and refuses changed ownership before cleanup", () => {
  let cleanup;
  const root = temporaryDirectory({ after(callback) { cleanup = callback; } }, "ownership-check-");
  const marker = path.join(root, ".fixture-owner");
  const owner = fs.readFileSync(marker);
  assert.equal(path.dirname(root), path.resolve(__dirname, "../artifacts/tests"));
  try {
    fs.writeFileSync(marker, "foreign-owner");
    assert.throws(cleanup, /ownership marker changed/);
    assert.equal(fs.existsSync(root), true);
  } finally { fs.writeFileSync(marker, owner); cleanup(); }
  assert.equal(fs.existsSync(root), false);
});

test("fixture names cannot escape the canonical artifact parent", () => {
  let registered = false;
  for (const prefix of [undefined, "", "../outside", "/absolute", "x".repeat(65), "name/file", "E:\\outside"]) {
    assert.throws(() => temporaryDirectory({ after() { registered = true; } }, prefix), /bounded lowercase name/);
  }
  assert.equal(registered, false);
});
