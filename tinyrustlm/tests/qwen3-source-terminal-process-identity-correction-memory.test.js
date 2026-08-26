"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const memoryRelativePath =
  "wiki/runtime-mirust/reports/tinyrustlm-qwen3-source-terminal-process-identity-correction-memory-2026-08-26.md";
const memoryLength = 9313;
const memorySha256 =
  "2f294466f779f23e3c1bc5c810ba693513c2b4a8be855163f3ee098a2fbaf18b";
const architectureRelativePath =
  "docs/architecture/2026-08-26-qwen3-source-terminal-process-identity-correction.md";
const historicalResultRelativePath =
  "contracts/vnext/qwen3-numerical-source-terminal-verification-result.v1.json";
const activeRoutes = [
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

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("freezes the process-identity correction memory and historical result", () => {
  const memory = read(memoryRelativePath);
  assert.equal(memory.length, memoryLength);
  assert.equal(sha256(memory), memorySha256);
  assert.equal(sha256(read(architectureRelativePath)),
    "b1b14674cfa4a4468085179ba66228fe05d1f5ab2a69ee1493262644b4dd3db6");

  const historicalResult = read(historicalResultRelativePath);
  assert.equal(historicalResult.length, 6268);
  assert.equal(sha256(historicalResult),
    "e27bbbf2e321bf79b6c7f9009427de191b492a9ab74537ba7751866e811076fa");
});

test("deep-links the correction checkpoint throughout active UAI memory", () => {
  for (const relativePath of activeRoutes) {
    const value = read(relativePath).toString("utf8");
    assert.match(value,
      new RegExp(memoryRelativePath.replaceAll("/", "\\/"), "u"), relativePath);
    assert.match(value, new RegExp(memorySha256, "u"), relativePath);
    assert.match(value, /efc29dd6007401497e76fad3ec3036c23b092213/u,
      relativePath);
    assert.match(value,
      /ca3d14f36cf8c2469dcac44cac690ff952b364288de29a2a108971a7a93e3f74/u,
      relativePath);
    assert.match(value,
      /f77821b7bfe51c6ab881494e0cc971716f83ab3f498b7fd7072fab6f7d6dd7d0/u,
      relativePath);
    assert.match(value, /terminal-ambiguous/u, relativePath);
    assert.match(value, /0\/20.*0\/50.*0\/25.*0\/40.*0\/20/u,
      relativePath);
    assert.match(value, /MemoryEndpoints/u, relativePath);
  }
});

test("keeps one durable pointer and one clean-slate successor route", () => {
  const ledger = read(".uai/long-term-memory.uai").toString("utf8");
  assert.match(ledger,
    /stable_id: tinyrustlm_qwen3_source_terminal_process_identity_correction/u);
  assert.match(ledger, /byte_length: 9313/u);
  assert.match(ledger, /successor preregistration/u);

  const memory = read(memoryRelativePath).toString("utf8");
  assert.match(memory, /wholly new output-free successor preregistration/u);
  assert.match(memory, /There is no permissive\s+parser/u);
  assert.doesNotMatch(memory, /E:\\TinyRustLM-vnext-private/u);
});

test("preserves the frozen goal and all-zero historical claim boundary", () => {
  const goal = read(
    "docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md");
  assert.equal(goal.length, 44224);
  assert.equal(sha256(goal),
    "92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0");

  const result = JSON.parse(read(historicalResultRelativePath).toString("utf8"));
  assert.equal(result.claimBoundary.sourceTerminalFailureIndependentlyVerified,
    false);
  assert.equal(result.claimBoundary.campaignCreditAuthorized, false);
  assert.deepEqual(Object.values(result.campaignCounters),
    ["0/20", "0/50", "0/25", "0/40", "0/20"]);
});
