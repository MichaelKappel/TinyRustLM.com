"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const { TextDecoder } = require("node:util");
const {
  productionLineageReader
} = require("./clean-history-lineage.js");

const defaultMaximumBytes = 16 * 1024 * 1024;
const relativePathPattern =
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const revisionPattern = /^[a-f0-9]{40}$/u;
const blobCache = new Map();
const candidateCache = new Map();

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function validateRequest(repositoryRoot, revision, relativePath, maximumBytes) {
  invariant(path.isAbsolute(repositoryRoot), "repository root must be absolute");
  invariant(revisionPattern.test(revision), "historical revision is invalid");
  invariant(relativePathPattern.test(relativePath), "historical path is unsafe");
  invariant(
    Number.isSafeInteger(maximumBytes) && maximumBytes > 0,
    "historical byte limit is invalid"
  );
}

function readGitBlob(
  repositoryRoot,
  revision,
  relativePath,
  maximumBytes = defaultMaximumBytes
) {
  validateRequest(repositoryRoot, revision, relativePath, maximumBytes);
  const cacheKey = `${path.resolve(repositoryRoot)}\u0000${revision}\u0000${relativePath}`;
  const cached = blobCache.get(cacheKey);
  if (cached !== undefined) {
    invariant(
      cached.length <= maximumBytes,
      `historical Git blob size is invalid: ${relativePath}`
    );
    return Buffer.from(cached);
  }
  let bytes;
  try {
    bytes = productionLineageReader().readBlob(
      revision,
      relativePath,
      maximumBytes
    );
  } catch (error) {
    throw new Error(
      `historical Git blob is unavailable: ${relativePath}`,
      { cause: error }
    );
  }
  invariant(
    bytes.length > 0 && bytes.length <= maximumBytes,
    `historical Git blob size is invalid: ${relativePath}`
  );
  blobCache.set(cacheKey, bytes);
  return Buffer.from(bytes);
}

function gitInputCandidates(
  repositoryRoot,
  revision,
  relativePath,
  maximumBytes = defaultMaximumBytes
) {
  validateRequest(repositoryRoot, revision, relativePath, maximumBytes);
  const cacheKey =
    `${path.resolve(repositoryRoot)}\u0000${revision}\u0000${relativePath}`;
  const cached = candidateCache.get(cacheKey);
  if (cached !== undefined) {
    invariant(
      cached.raw.bytes <= maximumBytes,
      `historical Git blob size is invalid: ${relativePath}`
    );
    return cached;
  }
  const bytes = readGitBlob(
    repositoryRoot,
    revision,
    relativePath,
    maximumBytes
  );
  const raw = Object.freeze({
    path: relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
  let crlf = null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.includes("\r") && text.includes("\n")) {
      const checkoutBytes = Buffer.from(text.replaceAll("\n", "\r\n"), "utf8");
      crlf = Object.freeze({
        path: relativePath,
        bytes: checkoutBytes.length,
        sha256: sha256(checkoutBytes)
      });
    }
  } catch {
    // Binary evidence has only its exact Git-blob identity.
  }
  const candidates = Object.freeze({ raw, crlf });
  candidateCache.set(cacheKey, candidates);
  return candidates;
}

function validateGitInput(
  reference,
  repositoryRoot,
  revision,
  relativePath,
  label,
  maximumBytes = defaultMaximumBytes
) {
  const candidates = gitInputCandidates(
    repositoryRoot,
    revision,
    relativePath,
    maximumBytes
  );
  if (JSON.stringify(reference) === JSON.stringify(candidates.raw)) {
    return "git-blob";
  }
  invariant(
    candidates.crlf !== null &&
      JSON.stringify(reference) === JSON.stringify(candidates.crlf),
    `${label} does not match its historical source revision`
  );
  return "lf-to-crlf-checkout";
}

module.exports = Object.freeze({
  defaultMaximumBytes,
  gitInputCandidates,
  readGitBlob,
  relativePathPattern,
  revisionPattern,
  sha256,
  validateGitInput
});
