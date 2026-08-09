"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const inventoryPath = path.resolve(
  __dirname,
  "../../docs/architecture/vnext-contract-inventory.md"
);
const expectedSchemas = Object.freeze([
  "tinyrustlm.vnext.artifact_manifest.v1",
  "tinyrustlm.vnext.receipt.v1",
  "tinyrustlm.vnext.context.v1",
  "tinyrustlm.vnext.worker_message.v1",
  "tinyrustlm.vnext.companion_message.v1",
  "tinyrustlm.vnext.p2p_manifest.v1",
  "tinyrustlm.vnext.outside_proof.v1",
  "tinyrustlm.vnext.release_manifest.v1",
  "tinyrustlm.vnext.claim.v1"
]);

test("freezes exactly nine incompatible vNext contract family names", () => {
  const text = fs.readFileSync(inventoryPath, "utf8");
  const identifiers = [...text.matchAll(/`(tinyrustlm\.vnext\.[a-z0-9_]+\.v1)`/gu)]
    .map((match) => match[1]);
  assert.deepEqual([...new Set(identifiers)], expectedSchemas);
  assert.match(text, /Every current identifier is historical implementation evidence only/u);
  assert.match(text, /vNext readers reject every non-vNext schema/u);
  assert.match(text, /does not increment any 20\/50\/25\/40\/20 campaign counter/u);
});

test("records the reproducible current schema and parser-call inventory", () => {
  const text = fs.readFileSync(inventoryPath, "utf8");
  assert.match(text, /109 source files/u);
  assert.match(text, /215 distinct matching schema identifiers/u);
  assert.match(text, /9,919 UTF-8 bytes/u);
  assert.match(text, /581eee525ee30f195f0a21cd71db8d60ff275866d51cb2d236df74f638bd6d10/u);
  assert.match(text, /77 app\/tool files contain 166 `JSON\.parse` call sites/u);
});

test("assigns every required class one owner, visibility, and byte limit", () => {
  const text = fs.readFileSync(inventoryPath, "utf8");
  for (const name of [
    "Artifact", "Receipt", "Context", "Worker", "Companion",
    "P2P", "Proof", "Release", "Claim"
  ]) {
    assert.ok(text.includes(`| ${name} | ` + "`tinyrustlm.vnext."),
      `${name} contract row is missing`);
  }
  assert.match(text, /Private volatile session data/u);
  assert.match(text, /Public-safe after mandatory redaction/u);
  assert.match(text, /SLM-DCBOR-1 metadata remain governed by\s+ADR-001/u);
});
