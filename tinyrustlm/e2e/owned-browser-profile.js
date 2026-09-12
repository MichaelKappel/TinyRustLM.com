"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const parent = path.resolve(__dirname, "../artifacts/playwright/profiles");
const owners = new Map();

/** Reject links and non-directory ancestors before creating or removing output. */
function assertDirectAncestry(directory) {
  for (let current = path.resolve(directory); ; current = path.dirname(current)) {
    try {
      const stat = fs.lstatSync(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error("Browser profile ancestry must contain only direct directories");
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (current === path.dirname(current)) break;
  }
}

/** Create an operation-owned browser profile under this project's artifacts. */
function createOwnedBrowserProfile(label) {
  if (typeof label !== "string" || !/^[a-z][a-z-]{0,47}$/.test(label)) {
    throw new Error("Browser profile label must be a bounded lowercase name");
  }
  assertDirectAncestry(parent);
  fs.mkdirSync(parent, { recursive: true });
  assertDirectAncestry(parent);
  const root = fs.mkdtempSync(path.join(parent, `${label}-`));
  const marker = JSON.stringify({ operation: "browser-contract-test", owner: crypto.randomUUID() });
  fs.writeFileSync(path.join(root, ".operation-owner.json"), marker, { flag: "wx" });
  owners.set(root, marker);
  return root;
}

/** Remove only this process's exact profile after its browser has closed. */
function removeOwnedBrowserProfile(profileRoot) {
  const root = path.resolve(profileRoot);
  const marker = owners.get(root);
  if (!marker || path.dirname(root) !== parent) {
    throw new Error("Browser profile is outside this operation's owned artifacts");
  }
  assertDirectAncestry(root);
  const markerPath = path.join(root, ".operation-owner.json");
  const stat = fs.lstatSync(markerPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== Buffer.byteLength(marker) ||
      fs.readFileSync(markerPath, "utf8") !== marker) {
    throw new Error("Browser profile ownership marker changed");
  }
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  if (fs.existsSync(root)) throw new Error("Owned browser profile remains after cleanup");
  owners.delete(root);
}

module.exports = { createOwnedBrowserProfile, removeOwnedBrowserProfile };
