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

const canonicalMemoryRoute =
  "wiki/runtime-mirust/reports/tinyrustlm-enterprise-intake-and-production-runtime-clean-cut-memory-2026-08-28.md";
const decisionIndexRoute =
  "wiki/runtime-mirust/reports/tinyrustlm-report-intake-decision-index-2026-08-28.md";

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
  assert.equal(
    policy.memoryEndpoints.productRole,
    "two_lane_agent_coordination_and_tinyrustlm_connect_memory"
  );
  assert.deepEqual(policy.memoryEndpoints.usesExactly, [
    "ecosystem_agent_coordination",
    "tinyrustlm_connect_user_plugin"
  ]);
  assert.equal(policy.memoryEndpoints.ecosystemAgentCoordination.directUse, true);
  assert.equal(
    policy.memoryEndpoints.ecosystemAgentCoordination.audience,
    "agents_working_across_all_ecosystem_sites"
  );
  assert.deepEqual(
    policy.memoryEndpoints.ecosystemAgentCoordination.capabilities,
    ["agent_to_agent_long_term_memory", "meetings", "handoffs", "coordination"]
  );
  assert.equal(
    policy.memoryEndpoints.tinyRustLmConnectUserPlugin.pluginName,
    "TinyRustLM.com Connect"
  );
  assert.equal(
    policy.memoryEndpoints.tinyRustLmConnectUserPlugin.userSignsInToMemoryEndpoints,
    true
  );
  assert.equal(
    policy.memoryEndpoints.tinyRustLmConnectUserPlugin.longTermMemoryProvider,
    true
  );
  assert.equal(policy.memoryEndpoints.laneSeparation.sharedCredentialsAllowed, false);
  assert.equal(policy.memoryEndpoints.laneSeparation.sharedIdentityOrConsentAllowed, false);
  assert.equal(policy.memoryEndpoints.laneSeparation.sharedReceiptAuthorityAllowed, false);
  assert.equal(policy.localFile.supported, true);
  assert.equal(policy.localFile.offlineCapable, true);
  assert.equal(policy.userControl.explicitOptInRequired, true);
  assert.equal(policy.userControl.silentUploadAllowed, false);
  assert.equal(policy.claimBoundary.reachabilityIsLifecycleProof, false);
  assert.equal(policy.claimBoundary.configuredCodeIsLifecycleProof, false);
  assert.equal(policy.claimBoundary.campaignCreditRequiresFreshReceipt, true);
  assert.equal(policy.prelaunchRedundancy.additionalLongTermMemoryCopiesAllowed, true);
  assert.equal(policy.prelaunchRedundancy.everyMaintainedCopyMustStayCurrent, true);
  assert.equal(policy.prelaunchRedundancy.contradictoryCopiesAllowed, false);
  assert.equal(policy.history.preserveImmutableEarlierEvidence, true);
  assert.equal(policy.history.earlierExclusionIsCurrentPolicy, false);
});

test("keeps hot memory bounded and routed to the current two-lane authority", () => {
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
    const source = read(relativePath);
    assert.match(source, new RegExp(canonicalMemoryRoute.replaceAll(".", "\\.")));
    assert.match(source, new RegExp(decisionIndexRoute.replaceAll(".", "\\.")));
    assert.doesNotMatch(
      source,
      /MemoryEndpoints\s+(?:is|remains)\s+unauthori[sz]ed|MemoryEndpoints\s+unauthori[sz]ed/i
    );
  }

  const authority = read(
    "docs/architecture/2026-08-26-memoryendpoints-portable-memory-authority.md"
  );
  assert.match(authority, /Direct ecosystem-agent coordination/);
  assert.match(authority, /TinyRustLM\.com Connect user memory/);
  assert.match(authority, /duplicated in current\s+`\.uai`, wiki/);
  assert.match(authority, /do not share identity, credentials, consent, scopes/);
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

test("documents both uses and the user-plugin lane on product surfaces", () => {
  const rootReadme = read("README.md");
  const browserReadme = read("tinyrustlm/README.md");
  const browserHtml = read("tinyrustlm/app/index.html");
  const browserRuntime = read("tinyrustlm/app/app.js");

  for (const source of [rootReadme, browserReadme]) {
    assert.match(source, /local (?:UAIX )?memory (?:file|deck)/i);
    assert.match(source, /MemoryEndpoints\.com/);
    assert.match(source, /strongly recommended/i);
    assert.match(source, /agent-to-agent long-term memory/i);
    assert.match(source, /TinyRustLM\.com Connect plugin/i);
    assert.match(source, /separate.*identity.*credentials.*consent.*scope.*receipts/is);
  }
  assert.doesNotMatch(rootReadme, /MemoryEndpoints is unauthorized and disconnected/);
  assert.match(
    browserHtml,
    /TinyRustLM\.com Connect memory via MemoryEndpoints\.com \(recommended\)/
  );
  assert.match(browserRuntime, /TinyRustLM\.com Connect plugin recommends MemoryEndpoints\.com/);
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
    assert.match(document, /ecosystem-agent|agent-to-agent/i);
    assert.match(document, /TinyRustLM\.com\s+Connect/i);
    assert.match(document, /separate|isolated/i);
    assert.match(document, /untrusted data/i);
    assert.doesNotMatch(
      document,
      /MemoryEndpoints.{0,120}(?:unauthorized|disconnected)|(?:unauthorized|disconnected).{0,120}MemoryEndpoints/is
    );
  }

  const project = read(
    "dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj"
  );
  assert.match(project, /direct ecosystem-agent coordination/i);
  assert.match(project, /TinyRustLM\.com Connect user-memory plugin/i);
  assert.match(project, /user signs in and selects MemoryEndpoints\.com/i);

  for (const verifier of [
    read("eng/verify-public-doc-sites.ps1"),
    read("eng/verify-public-doc-sites.sh")
  ]) {
    assert.match(verifier, /portable_memory_backbone_package/);
    assert.match(verifier, /ecosystem-agent-coordination/);
    assert.match(verifier, /tinyrustlm-connect-user-plugin/);
    assert.match(verifier, /allowed-if-synchronized/);
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
