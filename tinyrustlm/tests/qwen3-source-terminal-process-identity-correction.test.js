"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("keeps one exact two-field process identity contract", () => {
  const source = read(
    "tinyrustlm/tools/qwen3-numerical-source-terminal-verifier.js").toString("utf8");
  assert.match(source, /const pythonProcessIdentity = \{\s*byteLength: pythonIdentity\.byteLength,\s*sha256: pythonIdentity\.sha256\s*\};/u);
  assert.match(source, /artifactReference\(sourceTerminal\.executableBefore,\s*"source-terminal-process-shape"\);/u);
  assert.match(source, /artifactReference\(sourceTerminal\.executableAfter,\s*"source-terminal-process-shape"\);/u);
  assert.match(source,
    /sameValue\(sourceTerminal\.executableBefore, pythonProcessIdentity\)/u);
  assert.match(source,
    /sameValue\(sourceTerminal\.executableAfter, pythonProcessIdentity\)/u);
  assert.doesNotMatch(source,
    /sameValue\(sourceTerminal\.executable(?:Before|After), pythonIdentity\)/u);
});

test("documents failure preservation and the closed successor boundary", () => {
  const decision = read(
    "docs/architecture/2026-08-26-qwen3-source-terminal-process-identity-correction.md")
    .toString("utf8");
  assert.match(decision, /remains immutable `terminal-ambiguous`/u);
  assert.match(decision, /does not accept the three-field terminal shape/u);
  assert.match(decision, /wholly new operation ID and absent private output root/u);
  assert.match(decision, /MemoryEndpoints remains unauthorized/u);
  assert.match(decision,
    /`0\/20`, `0\/50`, `0\/25`, `0\/40`, and `0\/20`/u);
});

test("does not mutate the preserved v1 terminal result", () => {
  const resultBytes = read(
    "contracts/vnext/qwen3-numerical-source-terminal-verification-result.v1.json");
  assert.equal(resultBytes.length, 6268);
  assert.equal(sha256(resultBytes),
    "e27bbbf2e321bf79b6c7f9009427de191b492a9ab74537ba7751866e811076fa");
  const result = JSON.parse(resultBytes.toString("utf8"));
  assert.equal(result.status, "terminal-ambiguous");
  assert.equal(result.claimBoundary.sourceTerminalFailureIndependentlyVerified,
    false);
});

test("preserves the frozen continuation goal", () => {
  assert.equal(sha256(read(
    "docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md")),
  "92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0");
});
