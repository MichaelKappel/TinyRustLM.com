"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const memoryRelativePath =
  "wiki/runtime-mirust/reports/tinyrustlm-qwen3-model-load-correction-memory-2026-08-26.md";
const memoryLength = 20442;
const memorySha256 =
  "91764c9d5bde7d96e3d650396a1e882984b0b91baa0814c3b791f0d58321b4df";
const hotRoutes = [
  "workspace.uai",
  ".uai/index.uai",
  ".uai/long-term-memory.uai",
  ".uai/short-term-memory.uai",
  ".uai/operations.uai",
  ".uai/architecture.uai",
  ".uai/test-plan.uai",
  ".uai/receiver-brief.uai",
  ".uai/startup-packet.uai",
  ".uai/totem.uai",
  ".uai/taboo.uai",
  ".uai/next-recursive-prompt.uai",
  ".uai/file-handoff.uai"
];

function identity(relativePath) {
  const bytes = fs.readFileSync(path.join(repositoryRoot, relativePath));
  return {
    byteLength: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
}

test("durable model-load correction memory binds exact implementation evidence", () => {
  const memory = fs.readFileSync(path.join(repositoryRoot, memoryRelativePath), "utf8");
  assert.deepEqual(identity(memoryRelativePath), {
    byteLength: memoryLength,
    sha256: memorySha256
  });
  for (const relativePath of [
    "docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md",
    "docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26.md",
    "docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-tdd-delta-2026-08-26.md",
    "wiki/runtime-mirust/reports/tinyrustlm-post-v10-native-browser-release-intake-memory-2026-08-26.md",
    "contracts/vnext/qwen3-model-load-diagnostic-result.v2.json",
    "contracts/vnext/qwen3-numerical-differential-profile.v1.json",
    "contracts/vnext/qwen3-numerical-oracle-environment-lock.v1.json",
    "tinyrustlm/tools/qwen3-numerical-execution-owner.js",
    "tinyrustlm/tools/qwen3-numerical-source-owner.py",
    "tinyrustlm/tools/qwen3-numerical-trace-verifier.js"
  ]) {
    const value = identity(relativePath);
    assert.match(memory, new RegExp(value.sha256, "u"), relativePath);
  }
  assert.match(memory, /9f7be857927819e7946537c2562ef9238c06d8ba/u);
  assert.match(memory, /3a99169346fac0ff77aa529f4bdbd975b04ff316/u);
  assert.match(memory,
    /6f73ce1e2a9c5900f679ffd203900f4ba9de6b96f1dc7d214e032094cb9c7dd1/u);
  assert.match(memory,
    /237d46a1f140a6310ad4891028d63501c0000101cc212d6b3e95992141e12667/u);
  assert.match(memory, /b9b820299e463db3469b6cc5fc156b95aadc99eb/u);
  assert.match(memory, /7d6ec9ef5639528b7e9188495670362ef6ae65f3/u);
  assert.match(memory,
    /9ef25fd42c90714285ca86a58d20174c2efc1a8a037e8f90c5ec314f0f04561f/u);
  assert.match(memory,
    /0514f83b28a210ac195456553774daccf48be8129dc60d9b6ed5681be2d0105a/u);
  assert.match(memory,
    /e21c1c8459a64abbdf47d98c81ca4b5526e7b156ce9a72079c0f735d3515955d/u);
  assert.match(memory,
    /c04abffe412f5032b3c66d6ce00ece4d27a5d89f3ae6678e742cc56ce64f86fc/u);
  assert.match(memory, /787c7d3f4e23ff141514ba292667a852fd688580/u);
  assert.match(memory, /2512e6f409b9664700bfe1e49646d524b7715dab/u);
  assert.match(memory,
    /7e320cf108b751768a780083c7a8c59ec40b846508eaf8d4a4389e4c31d60bbb/u);
  assert.match(memory,
    /9be258173ae2e28c0e7bf754667c6f9c1ccba1ae2bf8c1aea930d9524949b3b7/u);
  assert.match(memory,
    /92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0/u);
});

test("every hot UAI route deep-links the correction and reviewed report memory", () => {
  for (const relativePath of hotRoutes) {
    const value = fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
    assert.match(value, new RegExp(memoryRelativePath.replaceAll("/", "\\/"), "u"),
      relativePath);
    assert.match(value, new RegExp(memorySha256, "u"), relativePath);
    assert.match(value,
      /tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26\.md/u,
      relativePath);
    assert.match(value,
      /tinyrustlm-post-v10-native-browser-release-intake-tdd-delta-2026-08-26\.md/u,
      relativePath);
    assert.match(value, /tinyrustlm\.qwen3_numerical_source_request\.v2/u,
      relativePath);
    assert.match(value, /tinyrustlm\.qwen3-publisher-source-trace\/2/u,
      relativePath);
    assert.match(value,
      /e21c1c8459a64abbdf47d98c81ca4b5526e7b156ce9a72079c0f735d3515955d/u,
      relativePath);
    assert.match(value,
      /c04abffe412f5032b3c66d6ce00ece4d27a5d89f3ae6678e742cc56ce64f86fc/u,
      relativePath);
    assert.match(value, /787c7d3f4e23ff141514ba292667a852fd688580/u,
      relativePath);
    assert.match(value,
      /7e320cf108b751768a780083c7a8c59ec40b846508eaf8d4a4389e4c31d60bbb/u,
      relativePath);
    assert.match(value,
      /9be258173ae2e28c0e7bf754667c6f9c1ccba1ae2bf8c1aea930d9524949b3b7/u,
      relativePath);
    assert.match(value, /0\/20.*0\/50.*0\/25.*0\/40.*0\/20/u, relativePath);
    assert.match(value, /MemoryEndpoints/u, relativePath);
  }
});

test("hot route inventory is exact and duplicate-free", () => {
  assert.equal(hotRoutes.length, 13);
  assert.equal(new Set(hotRoutes).size, hotRoutes.length);
  for (const relativePath of hotRoutes) {
    assert.equal(fs.lstatSync(path.join(repositoryRoot, relativePath)).isFile(), true);
  }
});
