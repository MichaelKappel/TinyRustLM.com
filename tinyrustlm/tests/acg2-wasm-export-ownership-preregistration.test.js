"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const { createRegisteredGitTree } = require("./helpers/registered-git-tree.js");

const profilePath =
  "contracts/vnext/acg2-wasm-export-ownership-preregistration.v1.json";
const requiredPaths = [
  "Cargo.toml",
  "Cargo.lock",
  "docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md",
  "docs/architecture/2026-08-20-production-slm2-acquisition-browser-release-goal.md",
  "rust/crates/tinyrustlm-composition2/Cargo.toml",
  "rust/crates/tinyrustlm-composition2/src/lib.rs",
  "rust/crates/tinyrustlm-composition2/src/wasm.rs",
  "rust/crates/tinyrustlm-runtime/Cargo.toml",
  "rust/crates/tinyrustlm-slm2-runtime-wasm-conformance/Cargo.toml",
  "rust/crates/tinyrustlm-slm2-runtime-wasm-conformance/src/lib.rs",
  "tinyrustlm/tests/acg2-format-vectors.test.js",
  "tinyrustlm/tests/slm2-runtime-wasm-conformance.test.js"
];
const registeredTree = createRegisteredGitTree({ profilePath, requiredPaths });
test.after(() => registeredTree.dispose());
const profileBytes = registeredTree.readFile(profilePath);
const profile = registeredTree.profile;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("binds the exact output-free baseline and prior unregistered observation", () => {
  assert.equal(profileBytes.length, 8994);
  assert.equal(sha256(profileBytes),
    "a14a74778ac366a8b7a051dac005e074caa610aa786dce3e93267be96aa33057");
  assert.equal(profile.schema,
    "tinyrustlm.acg2-wasm-export-ownership-preregistration.v1");
  assert.equal(profile.profileId, "tinyrustlm.acg2-wasm-export-ownership/1");
  assert.equal(profile.status, "registered-before-implementation-output");
  assert.equal(registeredTree.registrationParentCommit,
    "8c45d6855984e132f4e3404251a6194b514456cb");
  assert.equal(registeredTree.registrationParentTree,
    "cc29e028429f8a6082e565259c28ba2afad85a33");
  assert.equal(profile.priorDevelopmentObservation.commit,
    "db7cc1c03b09b89a5fff7f127f0bd437c0d33d17");
  assert.equal(profile.priorDevelopmentObservation.acceptedAsImplementationEvidence,
    false);

  assert.equal(profile.registeredBaseline.length, 10);
  assert.deepEqual(
    profile.registeredBaseline.map((entry) => entry.path),
    requiredPaths.filter((path) => !path.startsWith("docs/"))
  );
  for (const identity of profile.registeredBaseline) {
    const bytes = registeredTree.readFile(identity.path);
    assert.equal(bytes.length, identity.byteLength, identity.path);
    assert.equal(sha256(bytes), identity.sha256, identity.path);
  }
  for (const identity of [
    profile.authority.frozenEnterpriseGoal,
    profile.authority.productionGoal
  ]) {
    assert.equal(sha256(registeredTree.readFile(identity.path)), identity.sha256);
  }
});

test("registers two disjoint exact import-free WASM function surfaces", () => {
  const acg2 = profile.acg2WasmSurface;
  const slm2 = profile.slm2WasmSurface;
  assert.equal(acg2.requiredFunctionExports.length, 11);
  assert.equal(slm2.requiredFunctionExports.length, 11);
  assert.equal(new Set(acg2.requiredFunctionExports).size, 11);
  assert.equal(new Set(slm2.requiredFunctionExports).size, 11);
  assert.equal(acg2.requiredFunctionExports.some(
    (name) => slm2.requiredFunctionExports.includes(name)
  ), false);
  assert.equal(acg2.requiredFunctionExports.every(
    (name) => name.startsWith("trlm_acg2_conformance_")
  ), true);
  assert.equal(slm2.requiredFunctionExports.every(
    (name) => name.startsWith("trlm_slm2_conformance_")
  ), true);
  for (const surface of [acg2, slm2]) {
    assert.deepEqual(surface.requiredImports, []);
    assert.deepEqual(surface.requiredMemoryExports, ["memory"]);
    assert.equal(surface.unknownFunctionExportsReject, true);
    assert.equal(surface.nodeVectorReplayRequired, true);
    assert.equal(surface.freshChromiumVectorReplayRequired, true);
    assert.equal(surface.networkRequestCount, 0);
  }
});

test("registers compile-time feature ownership without a combined or fallback ABI", () => {
  assert.deepEqual(profile.ownership, {
    compositionFeature: "wasm-conformance",
    defaultFeatures: [],
    acg2ModuleCondition: "all(target_arch = wasm32, feature = wasm-conformance)",
    acg2TestEnablesFeatureExplicitly: true,
    runtimeDependencyEnablesFeature: false,
    slm2ConformanceBuildEnablesFeature: false,
    featureNegotiationAllowed: false,
    runtimeDetectionAllowed: false,
    combinedConformanceAbiAllowed: false
  });
  const manifest = registeredTree.readFile(
    "rust/crates/tinyrustlm-composition2/Cargo.toml"
  ).toString("utf8");
  const library = registeredTree.readFile(
    "rust/crates/tinyrustlm-composition2/src/lib.rs"
  ).toString("utf8");
  assert.doesNotMatch(manifest, /^\[features\]$/mu);
  assert.match(library, /#\[cfg\(target_arch = "wasm32"\)\]\s+mod wasm;/u);
  assert.equal(profile.implementation.separateTargetRootsRequired, true);
  assert.equal(profile.implementation.testWeakeningAllowed, false);
});

test("invalidates only affected module replay and creates no implementation claim", () => {
  assert.deepEqual(profile.invalidation, {
    acg2FormatProfileInvalidated: false,
    acg2FormatVectorsInvalidated: false,
    acg2ParserWriterSemanticsInvalidated: false,
    acg2PriorWasmModuleIdentityInvalidated: true,
    acg2PriorNodeBrowserReplayInvalidated: true,
    slm2PriorWasmModuleIdentityInvalidated: true,
    slm2PriorNodeBrowserReplayInvalidated: true,
    tokenizer2EvidenceInvalidated: false,
    template2EvidenceInvalidated: false,
    sampling2EvidenceInvalidated: false,
    prompt2EvidenceInvalidated: false,
    realModelEvidenceInvalidated: false
  });
  assert.equal(Object.values(profile.registrationOutputBoundary).every(
    (value) => value === false
  ), true);
  assert.equal(profile.claimBoundary.exportOwnershipRegistered, true);
  for (const [name, value] of Object.entries(profile.claimBoundary)) {
    if (name !== "exportOwnershipRegistered") assert.equal(value, false, name);
  }
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("keeps the registration bounded, public-safe, and free of compatibility debt", () => {
  assert.ok(profileBytes.length <= 16 * 1024);
  assert.doesNotMatch(profileBytes.toString("utf8"),
    /authorization:\s*bearer\s+|[?&](?:token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(profileBytes.toString("utf8"), /[CDE]:[\\/]/u);
  for (const name of [
    "legacyAbi", "compatibilityAlias", "migration", "fallback", "combinedAbi",
    "defaultEnabledConformanceFeature", "unknownExport", "network", "retry",
    "repair", "bestOfN", "expectedAnswerInjection", "fixtureAsModelQuality",
    "testWeakening"
  ]) {
    assert.equal(profile.prohibitions[name], false, name);
  }
});
