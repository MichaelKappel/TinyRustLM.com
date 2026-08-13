"use strict";

const path = require("node:path");

function resolveCargoTargetRoot(repositoryRoot, configured) {
  if (typeof repositoryRoot !== "string" || !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.includes("\0")) {
    throw new TypeError("repository root must be an absolute path");
  }
  const normalizedRepositoryRoot = path.normalize(repositoryRoot);
  if (normalizedRepositoryRoot === path.parse(normalizedRepositoryRoot).root) {
    throw new TypeError("repository root must not be a filesystem root");
  }
  if (configured === undefined || configured === "") {
    return path.join(normalizedRepositoryRoot, "target");
  }
  if (typeof configured !== "string" || !path.isAbsolute(configured) ||
      configured.includes("\0")) {
    throw new Error("CARGO_TARGET_DIR must be an absolute path");
  }
  const resolved = path.normalize(configured);
  if (resolved === path.parse(resolved).root) {
    throw new Error("CARGO_TARGET_DIR must not be a filesystem root");
  }
  return resolved;
}

module.exports = Object.freeze({ resolveCargoTargetRoot });
