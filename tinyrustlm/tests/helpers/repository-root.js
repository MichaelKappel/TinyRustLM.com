"use strict";

const fs = require("node:fs");
const path = require("node:path");

function resolveRepositoryRoot(options = {}) {
  const requiredFiles = options.requiredFiles || [];
  if (!Array.isArray(requiredFiles) ||
      requiredFiles.some((value) => typeof value !== "string" ||
        path.isAbsolute(value) || value.includes("\0") ||
        value.split(/[\\/]/u).includes(".."))) {
    throw new TypeError("repository root required files must be relative paths");
  }
  const configured = Object.getOwnPropertyDescriptor(
    process.env,
    "TINYRUSTLM_REPOSITORY_ROOT"
  );
  const candidates = configured && "value" in configured && configured.value
    ? [configured.value]
    : [process.cwd(), path.resolve(process.cwd(), ".."),
      path.resolve(__dirname, "../../..")];
  const matches = [];
  const identities = new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !path.isAbsolute(candidate) ||
        candidate.includes("\0")) {
      continue;
    }
    const normalized = path.normalize(candidate);
    const identity = process.platform === "win32"
      ? normalized.toLowerCase()
      : normalized;
    if (identities.has(identity)) continue;
    identities.add(identity);
    const files = ["Cargo.lock", "tinyrustlm/package.json", ...requiredFiles];
    try {
      if (files.every((file) =>
        fs.lstatSync(path.join(normalized, file)).isFile())) {
        matches.push(normalized);
      }
    } catch (_error) {
      // Only a complete candidate root is authoritative.
    }
  }
  if (matches.length !== 1) {
    const error = new Error("TinyRustLM repository root is not unique");
    error.code = "tinyrustlm_test_repository_root_invalid";
    throw error;
  }
  return matches[0];
}

module.exports = { resolveRepositoryRoot };
