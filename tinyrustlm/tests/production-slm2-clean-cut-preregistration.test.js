"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const profileRelativePath =
  "contracts/vnext/production-slm2-clean-cut-preregistration.v1.json";
const { createRegisteredGitTree } = require("./helpers/registered-git-tree.js");
const registeredTree = createRegisteredGitTree({
  profilePath: profileRelativePath,
  requiredPaths: [
    "Cargo.lock",
    "Cargo.toml",
    "docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md",
    "docs/architecture/2026-08-20-production-slm2-acquisition-browser-release-goal.md"
  ]
});
test.after(() => registeredTree.dispose());
const profileBytes = registeredTree.readFile(profileRelativePath);
const profile = registeredTree.profile;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readRepositoryFile(relativePath) {
  return registeredTree.readFile(relativePath);
}

test("binds the exact pre-cutover authority and immutable inputs", () => {
  assert.equal(profileBytes.length, 16398);
  assert.equal(sha256(profileBytes),
    "dc0213a34b63cf392c99e929bf0380d36698bce0ec995f5572aac2e8e287444a");
  assert.equal(profile.schema,
    "tinyrustlm.production-slm2-clean-cut-preregistration.v1");
  assert.equal(profile.status,
    "registered-before-workspace-or-executable-cutover");
  assert.equal(profile.registrationParentCommit,
    "49e261cf76d3d7256d6a3d1b7663e36424b95763");
  assert.equal(registeredTree.registrationCommit,
    "87f77d97d67aab7daa652b105776d2ddd2bbe13e");
  assert.equal(registeredTree.registrationParentCommit,
    profile.registrationParentCommit);
  assert.equal(profile.registrationParentTree,
    "6e735f93409d28d6fbf92adf3f4f1092c9eabee4");
  assert.equal(registeredTree.registrationParentTree,
    profile.registrationParentTree);
  assert.equal(profile.authority.productLifecycle, "prelaunch-single-product");
  assert.equal(profile.authority.productGenerationCount, 1);
  assert.equal(profile.authority.secondProductGenerationExists, false);
  assert.equal(profile.authority.technicalIdentifiersAreProductGenerations,
    false);

  for (const identity of [
    profile.authority.frozenEnterpriseGoal,
    profile.authority.productionGoal,
    profile.preCutoverInputs.rootCargoManifest,
    profile.preCutoverInputs.rootCargoLock
  ]) {
    const bytes = readRepositoryFile(identity.path);
    if (Object.hasOwn(identity, "byteLength")) {
      assert.equal(bytes.length, identity.byteLength, identity.path);
    }
    assert.equal(sha256(bytes), identity.sha256, identity.path);
  }
  assert.equal(profile.preCutoverInputs.acceptedCleanGate.rerunAuthorized,
    false);
  assert.equal(profile.preCutoverInputs.immutableTokenizer2Evidence
    .rerunAuthorized, false);
  assert.equal(profile.preCutoverInputs.immutableTemplate2Evidence
    .rerunAuthorized, false);
});

test("allows exact technical identities without creating a second product", () => {
  const examples = new Set(profile.authority.allowedTechnicalIdentityExamples);
  for (const identity of [
    "acg2.0",
    "org.minimodel.slm2/2.0",
    "org.minimodel.tokenizer2/2.0",
    "org.minimodel.template2/2.0",
    "org.minimodel.sampling2/2.0",
    "org.minimodel.prompt2/2.0"
  ]) {
    assert.equal(examples.has(identity), true, identity);
  }
  assert.equal(profile.artifactChain.compositionFormatProfile, "acg2.0");
  assert.equal(profile.artifactChain.runtimeRepackingAllowed, false);
  assert.equal(profile.artifactChain.unknownProfilesFailClosed, true);
});

test("forbids every compatibility debt and fake-success mechanism", () => {
  const rules = profile.cleanSlateRules;
  for (const name of [
    "legacyReaders",
    "legacyWriters",
    "dualRuntime",
    "dualArtifactFormat",
    "compatibilityAliases",
    "migrationShims",
    "deprecatedRoutes",
    "permissiveFallbacks",
    "temporaryFeatureFlags",
    "responseRepair",
    "hiddenRetries",
    "bestOfN",
    "expectedAnswerInjection",
    "fixtureAsProductSuccess",
    "testWeakening",
    "knownDebtAtRelease"
  ]) {
    assert.equal(rules[name], false, name);
  }
  assert.equal(rules.obsoleteExecutablePathsMustBeDeletedAfterReplacement,
    true);
});

test("assigns each production responsibility to one unique component", () => {
  const components = profile.canonicalComponentOwnership;
  assert.equal(components.length, 15);
  assert.equal(new Set(components.map((entry) => entry.componentId)).size,
    components.length);
  assert.equal(new Set(components.map((entry) => entry.path)).size,
    components.length);
  const byId = new Map(components.map((entry) => [entry.componentId, entry]));
  assert.equal(byId.get("runtime").path, "rust/crates/tinyrustlm-runtime");
  assert.equal(byId.get("converter").path, "rust/crates/tinyrustlm-convert");
  assert.equal(byId.get("browser-runtime-wasm").path,
    "rust/crates/tinyrustlm-browser-runtime-wasm");
  assert.equal(byId.get("composition2").path,
    "rust/crates/tinyrustlm-composition2");
});

test("registers the complete obsolete executable deletion closure", () => {
  const deletion = new Set(
    profile.obsoleteExecutableClosure.deleteCompletely
  );
  for (const obsoletePath of [
    "rust/crates/tinyrustlm-slm",
    "tinyrustlm/runtime",
    "tinyrustlm/tools/slm_pack",
    "tinyrustlm/tools/atomic-composition-activation-preregistration.js",
    "tinyrustlm/tests/atomic-composition-activation-preregistration.test.js",
    "tinyrustlm/experiments/specialist-portfolio/atomic-composition-activation-preregistration.v1.json"
  ]) {
    assert.equal(deletion.has(obsoletePath), true, obsoletePath);
  }
  const rewrite = new Set(
    profile.obsoleteExecutableClosure.rewriteWithoutCompatibilitySurface
  );
  for (const currentPath of [
    "rust/crates/tinyrustlm-runtime",
    "rust/crates/tinyrustlm-native",
    "rust/crates/tinyrustlm-p2p",
    "dotnet/src/TinyRustLM.Core",
    "dotnet/src/TinyRustLM.SeedHost/SeedHostBridgeConversionOperations.cs",
    "tinyrustlm/app/app.js"
  ]) {
    assert.equal(rewrite.has(currentPath), true, currentPath);
  }
});

test("freezes a bounded release-store algorithm instead of a timeout patch", () => {
  const replacement = profile.releaseStoreReplacement;
  assert.equal(replacement.maximumBatchEntries, 1024);
  assert.equal(replacement.maximumFullStoreRebuildsWithoutInjectedRestart, 2);
  assert.equal(replacement.maximumFullStoreRebuildsPerInjectedRestart, 2);
  assert.equal(replacement.maximumFullStoreRebuildsInsideAnyPerItemLoop, 0);
  assert.equal(replacement.maximumSameProcessMembershipFilesystemScans, 0);
  assert.equal(replacement.completeCapacityWallClockCeilingMs, 180000);
  assert.equal(replacement.forbiddenOptimization,
    "remove-validation-or-increase-timeout");
  assert.match(replacement.exhaustiveProofRule, /every-prefix/u);
  assert.match(replacement.physicalFaultRule,
    /before-first-midpoint-and-after-last-before-commit/u);
});

test("authorizes deliberate invalidation without broadening old evidence", () => {
  const invalidation = profile.intentionalInvalidation;
  assert.equal(invalidation.rootCargoManifestMayChange, true);
  assert.equal(invalidation.rootCargoLockMayChange, true);
  assert.equal(invalidation.acceptedCleanGateRemainsHistoricalEvidenceOnly,
    true);
  assert.equal(invalidation.runtimeEvidenceMustBeRegenerated, true);
  assert.equal(invalidation.conversionEvidenceMustBeGenerated, true);
  assert.equal(invalidation.browserChatEvidenceMustBeGenerated, true);
  assert.equal(invalidation.releaseEvidenceMustBeRegenerated, true);
});

test("creates no output or product claim at registration", () => {
  for (const value of Object.values(profile.registrationOutputBoundary)) {
    assert.equal(value, false);
  }
  for (const value of Object.values(profile.claimBoundary)) {
    assert.equal(value, false);
  }
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.authority.writeDriveDAllowed, false);
});

test("keeps the preregistration bounded and free of private output", () => {
  assert.ok(profileBytes.length <= 32768);
  assert.doesNotMatch(profileBytes.toString("utf8"),
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(profileBytes.toString("utf8"), /[CD]:[\\/]/u);
});
