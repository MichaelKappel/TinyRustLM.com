"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function currentMemoryAuthority(source, relativePath) {
  const marker = "memory_endpoints_portable_memory_authority_2026_08_26:";
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `${relativePath} must route current memory authority`);

  const historicalIndex = source.search(
    /MemoryEndpoints.{0,120}(?:unauthorized|disconnected)|(?:unauthorized|disconnected).{0,120}MemoryEndpoints/is
  );
  if (historicalIndex !== -1) {
    assert.ok(
      markerIndex < historicalIndex,
      `${relativePath} must route current MemoryEndpoints authority before history`
    );
  }

  const lines = source.slice(markerIndex).split(/\r?\n/u);
  const block = [lines[0]];
  for (const line of lines.slice(1)) {
    if (line && !line.startsWith("  ")) break;
    block.push(line);
  }
  assert.ok(block.length > 1, `${relativePath} current memory authority must be bounded`);
  return block.join("\n");
}

test("defines one current local-and-portable memory product policy", () => {
  const policy = readJson(
    "contracts/vnext/memory-endpoints-portable-memory-policy.v1.json"
  );

  assert.equal(
    policy.schema,
    "tinyrustlm.memory_endpoints_portable_memory_policy.v1"
  );
  assert.equal(policy.status, "current");
  assert.equal(policy.memoryEndpoints.authorization, "authorized");
  assert.equal(policy.memoryEndpoints.recommendation, "strongly_recommended");
  assert.equal(policy.memoryEndpoints.serviceOrigin, "https://memoryendpoints.com");
  assert.equal(policy.memoryEndpoints.productRole, "portable_web_memory_backbone");
  assert.equal(policy.localFile.supported, true);
  assert.equal(policy.localFile.offlineCapable, true);
  assert.equal(policy.userControl.explicitOptInRequired, true);
  assert.equal(policy.userControl.silentUploadAllowed, false);
  assert.equal(policy.claimBoundary.reachabilityIsLifecycleProof, false);
  assert.equal(policy.claimBoundary.configuredCodeIsLifecycleProof, false);
  assert.equal(policy.claimBoundary.campaignCreditRequiresFreshReceipt, true);
  assert.equal(policy.history.preserveImmutableEarlierEvidence, true);
  assert.equal(policy.history.earlierExclusionIsCurrentPolicy, false);
});

test("keeps current authority routes ahead of immutable historical records", () => {
  for (const relativePath of [
    "workspace.uai",
    ".uai/totem.uai",
    ".uai/memory-endpoints-coordination.uai",
    ".uai/short-term-memory.uai",
    ".uai/long-term-memory.uai",
    ".uai/index.uai",
    ".uai/architecture.uai",
    ".uai/operations.uai",
    ".uai/taboo.uai",
    ".uai/startup-packet.uai",
    ".uai/receiver-brief.uai",
    ".uai/next-recursive-prompt.uai"
  ]) {
    const authority = currentMemoryAuthority(read(relativePath), relativePath);
    assert.match(authority, /local_file_memory:\s+(?:supported|available)/);
    assert.match(authority, /recommendation:\s+strongly_recommended/);
  }
});

test("corrects the active research assignments without rewriting history", () => {
  const prompts = read(
    "docs/research-prompts/2026-08-25-twelve-disconnected-post-v10-contract-native-browser-release-research-prompts.md"
  );
  assert.doesNotMatch(prompts, /MemoryEndpoints is not authorized for this task/);
  assert.doesNotMatch(prompts, /MemoryEndpoints is unauthorized and outside this release/);
  assert.match(
    prompts,
    /Local memory files remain supported for device-local and offline continuity/
  );
  assert.match(
    prompts,
    /MemoryEndpoints\.com is the authorized, strongly recommended portable-memory\s+backbone/
  );
  assert.match(
    prompts,
    /Do not describe MemoryEndpoints as unauthorized/
  );
});

test("documents the same choice in product and browser surfaces", () => {
  const rootReadme = read("README.md");
  const browserReadme = read("tinyrustlm/README.md");
  const browserHtml = read("tinyrustlm/app/index.html");
  const browserRuntime = read("tinyrustlm/app/app.js");

  for (const source of [rootReadme, browserReadme]) {
    assert.match(source, /local (?:UAIX )?memory (?:file|deck)/i);
    assert.match(source, /MemoryEndpoints\.com/);
    assert.match(source, /strongly recommended/i);
    assert.match(source, /across devices|worldwide/i);
  }
  assert.doesNotMatch(rootReadme, /MemoryEndpoints is unauthorized and disconnected/);
  assert.match(browserHtml, /MemoryEndpoints\.com worldwide memory \(recommended\)/);
  assert.match(browserRuntime, /recommended for memory available worldwide and across devices/);
});

test("keeps current SDK and documentation-site claims aligned", () => {
  const currentDocuments = [
    "docs/nuget/README.md",
    "docs/nuget/API_BOUNDARY.md",
    "docs/nuget/PACKAGE_SECURITY.md",
    "docs/nuget/PRIVATE_FEED.md"
  ].map(read);

  for (const document of currentDocuments) {
    assert.match(document, /MemoryEndpoints\.com/);
    assert.match(document, /authorized/i);
    assert.match(document, /strongly recommended/i);
    assert.match(document, /untrusted data/i);
    assert.doesNotMatch(
      document,
      /MemoryEndpoints.{0,120}(?:unauthorized|disconnected)|(?:unauthorized|disconnected).{0,120}MemoryEndpoints/is
    );
  }

  const project = read(
    "dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj"
  );
  assert.match(project, /strongly recommended portable-memory connector/i);
  assert.match(project, /explicit user opt-in/i);

  for (const verifier of [
    read("eng/verify-public-doc-sites.ps1"),
    read("eng/verify-public-doc-sites.sh")
  ]) {
    assert.match(verifier, /portable_memory_backbone_package/);
    assert.doesNotMatch(verifier, /optional_disconnected_package/);
  }
});

test("preserves the frozen enterprise goal byte-for-byte", () => {
  const frozen = fs.readFileSync(path.join(
    repositoryRoot,
    "docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md"
  ));
  assert.equal(frozen.byteLength, 44224);
  assert.equal(
    crypto.createHash("sha256").update(frozen).digest("hex"),
    "92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0"
  );
});
