"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory,
  requireCanonicalArtifactPath, requireCanonicalSiteRoot, verifyOwnedTemporaryDirectory
} = require("../tools/canonical-operation-scratch.js");
const { temporaryDirectory } = require("./site-release-test-fixture.js");
const siteRoot = path.resolve(__dirname, "..");

test("canonical paths reject roots, siblings, relative paths, and alternate source roots", () => {
  assert.equal(requireCanonicalSiteRoot(), siteRoot);
  for (const invalid of ["", "relative", siteRoot, path.join(siteRoot, "artifacts"),
    path.join(siteRoot, "artifacts-other", "scratch"),
    path.join(siteRoot, "artifacts", "..", "scratch"), "D:\\LLMs\\TinyRustLM\\scratch"]) {
    assert.throws(() => requireCanonicalArtifactPath(invalid), /canonical project artifacts/);
  }
  assert.throws(() => requireCanonicalSiteRoot(path.dirname(siteRoot)), /canonical site/);
  assert.throws(() => verifyOwnedTemporaryDirectory(null), /ownership record/);
});

test("marked canonical scratch is verified and removed without touching sibling output", (context) => {
  const parent = temporaryDirectory(context, "canonical-operation-test-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent, siteRoot });
  assert.equal(path.dirname(owned.rootPath), parent);
  fs.mkdirSync(path.join(owned.rootPath, "nested"));
  fs.writeFileSync(path.join(owned.rootPath, "nested", "fixture.txt"), "synthetic output");
  const sibling = path.join(parent, "keep.txt");
  fs.writeFileSync(sibling, "keep");
  verifyOwnedTemporaryDirectory(owned);
  removeOwnedTemporaryDirectory(owned);
  assert.equal(fs.existsSync(owned.rootPath), false);
  assert.equal(fs.readFileSync(sibling, "utf8"), "keep");
});

test("changed markers and substituted ownership paths stop cleanup", (context) => {
  const parent = temporaryDirectory(context, "canonical-operation-identity-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  assert.throws(() => verifyOwnedTemporaryDirectory({ ...owned, temporaryParent: siteRoot }), /parent/);
  assert.throws(() => verifyOwnedTemporaryDirectory({ ...owned, markerPath: path.join(parent, "other") }), /marker path/);
  assert.throws(() => verifyOwnedTemporaryDirectory({ ...owned, rootStat: { dev: -1n, ino: -1n } }), /directory identity/);
  fs.writeFileSync(owned.markerPath, Buffer.alloc(owned.markerBytes.length, 48));
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /marker content/);
  fs.writeFileSync(owned.markerPath, "wrong length");
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /marker identity/);
  fs.writeFileSync(owned.markerPath, owned.markerBytes);
  removeOwnedTemporaryDirectory(owned);
});

test("linked and dangling ancestors and linked cleanup children are rejected", (context) => {
  const parent = temporaryDirectory(context, "canonical-operation-links-");
  const target = path.join(parent, "target");
  fs.mkdirSync(target);
  const link = path.join(parent, "link");
  fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => requireCanonicalArtifactPath(path.join(link, "new")), /ancestry/);
  fs.rmdirSync(target);
  assert.throws(() => requireCanonicalArtifactPath(link), /ancestry/);
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const child = path.join(owned.rootPath, "link");
  fs.symlinkSync(parent, child, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /linked or special/);
  fs.unlinkSync(child);
  fs.unlinkSync(link);
  removeOwnedTemporaryDirectory(owned);
});

test("cleanup accepts hard links wholly inside the owned tree", context => {
  const parent = temporaryDirectory(context, "canonical-operation-internal-links-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const original = path.join(owned.rootPath, "original");
  fs.writeFileSync(original, "synthetic compiled artifact");
  fs.mkdirSync(path.join(owned.rootPath, "nested"));
  fs.linkSync(original, path.join(owned.rootPath, "nested", "alias"));
  removeOwnedTemporaryDirectory(owned);
  assert.equal(fs.existsSync(owned.rootPath), false);
});

test("an external hard-link name rejects cleanup before removing anything", context => {
  const parent = temporaryDirectory(context, "canonical-operation-external-links-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const original = path.join(owned.rootPath, "original");
  const alias = path.join(owned.rootPath, "alias");
  const external = path.join(parent, "external");
  fs.writeFileSync(original, "retained evidence");
  fs.linkSync(original, alias);
  fs.linkSync(original, external);
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /external hard link/);
  for (const file of [original, alias, external]) {
    assert.equal(fs.readFileSync(file, "utf8"), "retained evidence");
  }
  fs.unlinkSync(alias);
  fs.unlinkSync(original);
  removeOwnedTemporaryDirectory(owned);
  assert.equal(fs.readFileSync(external, "utf8"), "retained evidence");
});

test("excessive cleanup depth preserves the owned tree for review", (context) => {
  const parent = temporaryDirectory(context, "canonical-operation-depth-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const deep = path.join(owned.rootPath, ...Array(34).fill("d"));
  fs.mkdirSync(deep, { recursive: true });
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /depth/);
  assert.equal(fs.existsSync(deep), true);
});
