"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { atomicCreate, atomicReplace } = require("../tools/durable-files.js");

test("atomicCreate is idempotent only for identical immutable bytes", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-durable-create-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "nested", "receipt.json");
  atomicCreate(target, Buffer.from("one", "utf8"));
  atomicCreate(target, Buffer.from("one", "utf8"));
  assert.equal(fs.readFileSync(target, "utf8"), "one");
  assert.throws(() => atomicCreate(target, Buffer.from("two", "utf8")),
    /differs from the committed payload/);
  assert.deepEqual(fs.readdirSync(path.dirname(target)).sort(), ["receipt.json"]);
});

test("atomicReplace publishes complete replacement bytes and removes temporary files", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-durable-replace-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "dashboard.json");
  atomicReplace(target, "first");
  atomicReplace(target, "second");
  assert.equal(fs.readFileSync(target, "utf8"), "second");
  assert.deepEqual(fs.readdirSync(root).sort(), ["dashboard.json"]);
});
