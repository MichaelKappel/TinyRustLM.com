"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  assertSafeRegularFile,
  atomicCreateExclusive,
  ensureSafeDirectory
} = require("../tools/immutable-publication-files.js");

test("immutable publication refuses even identical replacement bytes", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-web-immutable-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "receipt.json");
  atomicCreateExclusive(target, "one");
  assert.throws(
    () => atomicCreateExclusive(target, "one"),
    (error) =>
      error?.code === "EEXIST" &&
      !String(error.message).includes(root)
  );
  assert.equal(fs.readFileSync(target, "utf8"), "one");
  assert.deepEqual(fs.readdirSync(root), ["receipt.json"]);
});

test("release files reject directory-junction ancestry before writing", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-web-link-"));
  const targetRoot = path.join(root, "target");
  const junctionPath = path.join(root, "junction");
  context.after(() => {
    fs.rmSync(junctionPath, { force: true });
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.mkdirSync(targetRoot);
  fs.writeFileSync(path.join(targetRoot, "existing.json"), "{}\n");
  fs.symlinkSync(targetRoot, junctionPath, "junction");

  assert.throws(
    () => ensureSafeDirectory(path.join(junctionPath, "nested")),
    /unsafe/
  );
  assert.throws(
    () => assertSafeRegularFile(path.join(junctionPath, "existing.json")),
    /unsafe/
  );
  assert.equal(fs.existsSync(path.join(targetRoot, "nested")), false);
});
