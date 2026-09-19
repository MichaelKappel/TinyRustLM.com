"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { requireModelOutputRoot } = require("../../tools/huggingface-candidate-storage.js");

const parent = "D:\\LLMs\\TinyRustLM\\artifacts\\tests\\source-acquisition";

/** Keep synthetic model bytes in the actual canonical model store, with bounded owned cleanup. */
function createSourceAcquisitionFixture() {
  requireModelOutputRoot(parent);
  fs.mkdirSync(parent, { recursive: true });
  requireModelOutputRoot(parent);
  const rootPath = fs.mkdtempSync(path.join(parent, "fixture-"));
  const identity = fs.lstatSync(rootPath, { bigint: true });
  const marker = path.join(rootPath, ".fixture-owner");
  const token = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(marker, token, { flag: "wx" });
  const markerIdentity = fs.lstatSync(marker, { bigint: true });
  return { rootPath,
    /** Inspect exact ownership and ordinary bounded contents before removing this fixture. */
    remove() {
      requireModelOutputRoot(rootPath);
      assert.equal(path.dirname(rootPath), parent);
      const current = fs.lstatSync(rootPath, { bigint: true });
      assert.equal(current.ino, identity.ino);
      assert.equal(current.dev, identity.dev);
      const mark = fs.lstatSync(marker, { bigint: true });
      assert.equal(mark.ino, markerIdentity.ino);
      assert.equal(mark.nlink, 1n);
      assert.equal(mark.isSymbolicLink(), false);
      assert.equal(fs.readFileSync(marker, "utf8"), token);
      const pending = [rootPath];
      let entries = 0;
      let bytes = 0;
      while (pending.length) {
        for (const name of fs.readdirSync(pending.pop(), { withFileTypes: true })) {
          const full = path.join(name.parentPath, name.name);
          const stat = fs.lstatSync(full);
          assert.equal(stat.isSymbolicLink(), false);
          assert.ok(++entries <= 128);
          if (stat.isDirectory()) pending.push(full);
          else {
            assert.ok(stat.isFile() && stat.nlink === 1);
            bytes += stat.size;
            assert.ok(bytes <= 16 * 1024 * 1024);
          }
        }
      }
      fs.rmSync(rootPath, { recursive: true });
      assert.equal(fs.existsSync(rootPath), false);
      return { entries, logicalBytes: bytes };
    }
  };
}

module.exports = Object.freeze({ createSourceAcquisitionFixture });
