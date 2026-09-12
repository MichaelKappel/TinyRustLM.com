"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createOwnedBrowserProfile, removeOwnedBrowserProfile } = require("../e2e/owned-browser-profile.js");

test("owned profile data is confined to project artifacts and removed exactly", () => {
  const root = createOwnedBrowserProfile("cleanup-test");
  try {
    assert.equal(path.dirname(root), path.resolve(__dirname, "../artifacts/playwright/profiles"));
    fs.writeFileSync(path.join(root, "probe.bin"), Buffer.from("bounded non-product data"));
    assert.throws(() => removeOwnedBrowserProfile(path.dirname(root)), /outside this operation/);
  } finally { removeOwnedBrowserProfile(root); }
  assert.equal(fs.existsSync(root), false);
  assert.throws(() => removeOwnedBrowserProfile(root), /outside this operation/);
});

test("changed profile ownership refuses deletion and preserves its contents", () => {
  const root = createOwnedBrowserProfile("ownership-test");
  const marker = path.join(root, ".operation-owner.json");
  const original = fs.readFileSync(marker);
  try {
    fs.writeFileSync(marker, "foreign-owner");
    assert.throws(() => removeOwnedBrowserProfile(root), /ownership marker changed/);
    assert.equal(fs.readFileSync(marker, "utf8"), "foreign-owner");
  } finally {
    fs.writeFileSync(marker, original);
    removeOwnedBrowserProfile(root);
  }
});

test("invalid profile labels cannot create output outside the owned parent", () => {
  for (const label of [undefined, "", "../foreign", "/absolute", "E:\\foreign", "test/name", "a".repeat(49)]) {
    assert.throws(() => createOwnedBrowserProfile(label), /bounded lowercase name/);
  }
});
