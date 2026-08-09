"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const reviewPath = path.join(root, "docs/architecture/vnext-contract-threat-review.md");
const registryPath = path.join(root, "contracts/vnext/contract-family.v1.json");
const corpusPath = path.join(root, "contracts/vnext/contract-corpus.v1.json");
const registryValidatorPath = path.join(
  root,
  "tinyrustlm/tools/vnext-contract-validator-registry.js"
);
const independentValidatorPath = path.join(
  root,
  "tinyrustlm/tools/vnext-contract-validator-independent.js"
);
const generatorPath = path.join(root, "tinyrustlm/tools/vnext-contract-corpus-generator.js");
const conformancePath = path.join(
  root,
  "tinyrustlm/tests/vnext-contract-validator-conformance.test.js"
);

const sha256 = (filePath) => crypto.createHash("sha256")
  .update(fs.readFileSync(filePath))
  .digest("hex");

test("binds the Phase 2 threat review to every material validator input", () => {
  const review = fs.readFileSync(reviewPath, "utf8");
  for (const filePath of [
    registryPath,
    corpusPath,
    registryValidatorPath,
    independentValidatorPath,
    generatorPath,
    conformancePath
  ]) {
    assert.match(review, new RegExp(sha256(filePath), "u"), path.relative(root, filePath));
  }
  assert.match(review, /PASS for the Phase 2 schema-and-local-invariant boundary only/u);
  assert.match(review, /A deferred invariant is never[\s\S]*pass\./u);
  assert.match(review, /Campaign counters remain `0\/20`, `0\/50`, `0\/25`, `0\/40`, and `0\/20`/u);
});

test("keeps the two boundary validators strict and independently sourced", () => {
  const registrySource = fs.readFileSync(registryValidatorPath, "utf8");
  const independentSource = fs.readFileSync(independentValidatorPath, "utf8");
  for (const source of [registrySource, independentSource]) {
    assert.doesNotMatch(source, /JSON\.parse/u);
    assert.doesNotMatch(source, /\b(?:legacy|migration|fallback|deprecated|schemaAlias|aliases)\b/iu);
  }
  assert.doesNotMatch(registrySource, /vnext-contract-validator-independent/u);
  assert.doesNotMatch(independentSource, /vnext-contract-validator-registry/u);
  assert.doesNotMatch(independentSource, /contract-family\.v1\.json/u);
  assert.doesNotMatch(independentSource, /\brequire\(["']node:fs["']\)/u);
});

test("records every major deferred security boundary without promotion language", () => {
  const review = fs.readFileSync(reviewPath, "utf8");
  for (const [label, pattern] of [
    ["RFC 8785/JCS cross-language", /RFC 8785\/JCS cross-language/u],
    ["Ed25519 verification", /Ed25519 verification/u],
    ["Receipt DAG parent loading", /Receipt DAG parent loading/u],
    ["bounded secret/redaction scanning", /bounded secret\/redaction scanning/u],
    ["Rust, browser/WASM", /Rust, browser\/WASM/u],
    ["authorized live MemoryEndpoints continuity",
      /authorized live\s+MemoryEndpoints continuity/u],
    ["independent outside-network lane proofs", /independent outside-network lane proofs/u]
  ]) {
    assert.match(review, pattern, label);
  }
  assert.doesNotMatch(review, /production(?:-| )ready/iu);
  assert.doesNotMatch(review, /campaign complete/iu);
});
