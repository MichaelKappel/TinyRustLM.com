"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const memoryRelativePath =
  "wiki/runtime-mirust/reports/tinyrustlm-qwen3-source-terminal-verification-v1-memory-2026-08-26.md";
const memorySha256 =
  "136f57824298775a3d272d1bbf68ccdc501094fd662cb8b043f90f9e59cb4719";
const resultRelativePath =
  "contracts/vnext/qwen3-numerical-source-terminal-verification-result.v1.json";
const resultSha256 =
  "e27bbbf2e321bf79b6c7f9009427de191b492a9ab74537ba7751866e811076fa";

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("freezes the durable verification memory and public result", () => {
  const memory = read(memoryRelativePath);
  const result = read(resultRelativePath);
  assert.equal(memory.length, 9317);
  assert.equal(sha256(memory), memorySha256);
  assert.equal(result.length, 6268);
  assert.equal(sha256(result), resultSha256);
});

test("deep-links the durable record throughout active UAI memory", () => {
  const routes = [
    "workspace.uai",
    ".uai/short-term-memory.uai",
    ".uai/long-term-memory.uai",
    ".uai/index.uai",
    ".uai/architecture.uai",
    ".uai/operations.uai",
    ".uai/totem.uai",
    ".uai/taboo.uai",
    ".uai/startup-packet.uai",
    ".uai/receiver-brief.uai"
  ];
  for (const route of routes) {
    const text = read(route).toString("utf8");
    assert.match(text, new RegExp(memoryRelativePath.replaceAll("/", "\\/")),
      route);
    assert.match(text, new RegExp(memorySha256), route);
    assert.match(text, /terminal-ambiguous/, route);
  }
});

test("keeps the long-term pointer and reviewed report route explicit", () => {
  const ledger = read(".uai/long-term-memory.uai").toString("utf8");
  const memory = read(memoryRelativePath).toString("utf8");
  assert.match(ledger,
    /stable_id: tinyrustlm_qwen3_source_terminal_verification_v1_terminal_ambiguous/);
  assert.match(ledger, /bytes: 9317/);
  assert.match(memory,
    /docs\/report-intake\/2026-08-26\/post-v10-native-browser-release\/MANIFEST\.md/);
  assert.match(memory, /The twelve raw reports are advisory/);
});

test("preserves the frozen continuation goal and all-zero claim boundary", () => {
  const goal = read(
    "docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md");
  assert.equal(sha256(goal),
    "92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0");
  const result = JSON.parse(read(resultRelativePath).toString("utf8"));
  assert.equal(result.claimBoundary.sourceTerminalFailureIndependentlyVerified,
    false);
  assert.equal(result.claimBoundary.campaignCreditAuthorized, false);
  assert.deepEqual(Object.values(result.campaignCounters),
    ["0/20", "0/50", "0/25", "0/40", "0/20"]);
});
