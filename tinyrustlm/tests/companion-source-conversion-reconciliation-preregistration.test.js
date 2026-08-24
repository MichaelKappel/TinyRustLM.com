"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(
  repositoryRoot,
  "contracts/vnext/companion-source-conversion-reconciliation-preregistration.v1.json"
);
const decisionPath = path.join(
  repositoryRoot,
  "docs/architecture/2026-08-24-companion-source-conversion-reconciliation-preregistration.md"
);
const profileBytes = fs.readFileSync(profilePath);
const decisionBytes = fs.readFileSync(decisionPath);
const profile = parseStrictJson(profileBytes, { maximumBytes: 32 * 1024 });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("pins the output-free reconciliation registration", () => {
  assert.equal(profileBytes.length, 19124);
  assert.equal(sha256(profileBytes),
    "087038104f63d6e78373691034aaf586de803059d68c47a12acc2140bf3ac971");
  assert.equal(decisionBytes.length, 18524);
  assert.equal(sha256(decisionBytes),
    "c4fe01d64a65c51e8803ae4b16bc18bfd52b868faaadf5e4003f4f40b362a180");
  assert.equal(profile.schema,
    "tinyrustlm.companion-source-conversion-reconciliation-preregistration.v1");
  assert.equal(profile.profileId,
    "tinyrustlm.companion-source-conversion-reconciliation/1");
  assert.equal(profile.status,
    "registered-before-reconciliation-implementation-and-output");
  assert.equal(profile.registrationParentCommit,
    "d0c589cb984fd4eb70271dc3ff3f3beae5d363f3");
  assert.equal(profile.registrationParentTree,
    "c6beb42bb8a89376a63050f83df30d05ef5153ef");
  assert.ok(profileBytes.length <= 32 * 1024);
});

test("binds the exact preimplementation source closure", () => {
  const expectedPaths = [
    "dotnet/src/TinyRustLM.Companion/CompanionContracts.cs",
    "dotnet/src/TinyRustLM.Companion/CompanionOperationJournal.cs",
    "dotnet/src/TinyRustLM.Companion/CompanionSourceConversion.cs",
    "dotnet/src/TinyRustLM.Companion/TinyRustLM.Companion.csproj",
    "dotnet/src/TinyRustLM.Conversion/TinyRustLmConversionTool.cs",
    "dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj",
    "dotnet/tests/TinyRustLM.Companion.Tests/CompanionContractTests.cs",
    "dotnet/tests/TinyRustLM.Companion.Tests/CompanionOperationJournalTests.cs",
    "dotnet/tests/TinyRustLM.Companion.Tests/CompanionSourceConversionTests.cs",
    "dotnet/tests/TinyRustLM.Companion.Tests/TinyRustLM.Companion.Tests.csproj",
    "dotnet/tools/TinyRustLM.ConversionFixtureTool/Program.cs",
    "dotnet/tools/TinyRustLM.ConversionFixtureTool/TinyRustLM.ConversionFixtureTool.csproj",
    "rust/crates/tinyrustlm-convert/src/qwen3_composition.rs",
    "contracts/vnext/qwen3-composition-conversion-profile.v1.json"
  ];
  assert.deepEqual(profile.registeredSourceClosure.map((entry) => entry.path),
    expectedPaths);
  assert.equal(new Set(expectedPaths).size, expectedPaths.length);
  for (const entry of profile.registeredSourceClosure) {
    assert.ok(Number.isSafeInteger(entry.byteLength) && entry.byteLength > 0,
      entry.path);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/u, entry.path);
  }
  const rustOwner = profile.registeredSourceClosure.find((entry) =>
    entry.path === "rust/crates/tinyrustlm-convert/src/qwen3_composition.rs");
  assert.deepEqual(rustOwner, {
    path: "rust/crates/tinyrustlm-convert/src/qwen3_composition.rs",
    byteLength: 59532,
    sha256: "ff6f338c4abf1311e702072cf54dee592a8b075b5076d1e67e7714b9ac4b1966"
  });
});

test("keeps one clean prelaunch product and no compatibility surface", () => {
  assert.deepEqual(profile.productBoundary, {
    productCount: 1,
    prelaunch: true,
    legacySupport: false,
    compatibilityReaders: false,
    migrationWriters: false,
    aliases: false,
    fallbacks: false,
    responseRepair: false,
    automaticRetry: false,
    bestOfN: false
  });
  assert.equal(profile.authority.productLifecycle,
    "prelaunch-single-product");
  assert.equal(profile.authority.technicalVersionIsProductGeneration, false);
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.authority.writeDriveDAllowed, false);
});

test("freezes exact intent and replacement journal identities", () => {
  assert.deepEqual(profile.exactTechnicalIdentities, {
    compositionProfileId: "tinyrustlm.qwen3-complete-composition-conversion/1",
    compositionProfileSha256:
      "2f95f79783ec6cd12160d51f9697c5c77aab2e6cd46afeb5140fdb513e5d8158",
    nativeAttemptSchema: "tinyrustlm.qwen3_composition_attempt.v1",
    nativePassSchema: "tinyrustlm.qwen3_composition_conversion_receipt.v1",
    nativeRejectionSchema: "tinyrustlm.qwen3_composition_rejection.v1",
    managedIntentSchema: "tinyrustlm.qwen3-composition-conversion-intent.v1",
    companionIntentSchema: "tinyrustlm.companion.source-conversion-intent.v1",
    operationRecordSchema: "tinyrustlm.companion.operation.v2",
    durableCompositionSchema: "tinyrustlm.verified-composition.v1",
    liveObservationSchema: "tinyrustlm.composition-conversion-live-observation.v1"
  });
  assert.equal(profile.operationJournalCutover.priorSchemaReaderRetained, false);
  assert.equal(profile.operationJournalCutover.migrationWritten, false);
  assert.equal(profile.operationJournalCutover.newField,
    "sourceConversionIntentSha256");
  assert.equal(profile.operationJournalCutover.createValue, null);
  assert.equal(profile.operationJournalCutover.peerBranchValue, null);
  assert.equal(profile.operationJournalCutover.sourceConvertingValue, "required");
  assert.equal(profile.operationJournalCutover.immutabilityRule,
    "once-non-null-the-intent-hash-never-changes-or-returns-to-null");
});

test("defines one canonical private create-only intent", () => {
  assert.deepEqual(profile.managedConversionIntent.canonicalFieldsInOrder, [
    "schema",
    "modelSourceLockPath",
    "modelSourceLockSha256",
    "modelSourceDirectory",
    "tokenizerSourceLockPath",
    "tokenizerSourceLockSha256",
    "tokenizerSourceDirectory",
    "compositionProfileSha256",
    "outputRoot",
    "converterExecutablePath",
    "converterExecutableSha256",
    "maximumDurationMilliseconds",
    "maximumSummaryBytes",
    "maximumErrorBytes",
    "terminalRule"
  ]);
  assert.equal(profile.managedConversionIntent.terminalRule,
    "existing-output-root-is-never-resumed");
  assert.equal(profile.managedConversionIntent.pathRules.outputRootMustBeAbsentAtCreation,
    true);
  assert.equal(profile.managedConversionIntent.identityRules
    .converterExecutableRehashedImmediatelyBeforeLaunch, true);
  assert.deepEqual(profile.managedConversionIntent.policyBounds, {
    minimumDurationMilliseconds: 1,
    maximumDurationMilliseconds: 604800000,
    minimumSummaryBytes: 1,
    maximumSummaryBytes: 1048576,
    minimumErrorBytes: 1,
    maximumErrorBytes: 65536
  });
  assert.deepEqual(profile.companionIntentEnvelope.canonicalFieldsInOrder, [
    "schema", "operationId", "requestSha256", "conversion"
  ]);
  assert.equal(profile.companionIntentEnvelope.fileName,
    "source-conversion.intent.json");
  assert.equal(profile.companionIntentEnvelope.writeMode, "create-only");
  assert.equal(profile.companionIntentEnvelope.maximumBytes, 65536);
  assert.equal(profile.companionIntentEnvelope.publicEvidence, false);
  assert.equal(profile.companionIntentEnvelope.containsPrivatePaths, true);
  assert.equal(profile.companionIntentEnvelope.publicErrorMayContainPath, false);
});

test("separates durable composition proof from live process observations", () => {
  assert.deepEqual(profile.durableAndLiveResultSeparation.durableFields, [
    "schema",
    "operationId",
    "outputRoot",
    "receiptPath",
    "receiptSha256",
    "artifacts",
    "graphIdentitySha256",
    "modelSourceLockSha256",
    "tokenizerSourceLockSha256",
    "converterVersion",
    "converterExecutableSha256",
    "requiredNextGate"
  ]);
  assert.deepEqual(profile.durableAndLiveResultSeparation.liveFields, [
    "schema", "summarySha256", "duration"
  ]);
  assert.equal(profile.durableAndLiveResultSeparation
    .recoveredResultMayClaimProcessExit, false);
  assert.equal(profile.durableAndLiveResultSeparation
    .recoveredResultMayClaimStdout, false);
  assert.equal(profile.durableAndLiveResultSeparation
    .recoveredResultMayClaimDuration, false);
  assert.equal(profile.durableAndLiveResultSeparation
    .recoveredResultMayClaimStructuralComposition, true);
});

test("requires independent strict verification for pass and rejection", () => {
  assert.deepEqual(profile.terminalInspector.statuses,
    ["pending", "pass", "rejected"]);
  assert.equal(profile.terminalInspector.rootRules.absentRoot, "pending");
  assert.equal(profile.terminalInspector.rootRules.passAndRejectionBothPresent,
    "invalid");
  assert.ok(profile.terminalInspector.passVerification.includes(
    "all-six-artifact-lengths-and-streamed-sha256-identities"));
  assert.ok(profile.terminalInspector.passVerification.includes(
    "strict-nonclaim-boundary"));
  assert.ok(profile.terminalInspector.rejectionVerification.includes(
    "attempt-source-profile-operation-and-converter-identities-match-intent-and-rejection"));
  assert.deepEqual(profile.terminalInspector.recoveryDoesNotRequire, [
    "captured-stdout",
    "captured-stderr",
    "exit-code",
    "duration",
    "current-source-lock-files",
    "current-source-directories",
    "current-converter-executable"
  ]);
});

test("freezes the no-guess reconciliation decision table", () => {
  assert.deepEqual(profile.companionReconciliation.admittedCurrentStates,
    ["Converting", "VerifyingComposition"]);
  assert.equal(profile.companionReconciliation.requiredBranch, "Source");
  assert.equal(profile.companionReconciliation.pendingCode,
    "awaiting-terminal-evidence");
  assert.equal(profile.companionReconciliation.invalidEvidenceCode,
    "companion-conversion-terminal-invalid");
  for (const field of [
    "noStateChangeForPending",
    "noProcessLaunch",
    "noProcessAdoption",
    "noPidInference",
    "noTimestampInference",
    "noProcessKill",
    "noAutomaticRetry",
    "noOutputMutation",
    "terminalJournalStatesAreImmutable"
  ]) {
    assert.equal(profile.companionReconciliation[field], true, field);
  }
  const decisions = profile.companionReconciliation.recoveryDecisionTable;
  assert.equal(decisions.length, 6);
  assert.deepEqual(decisions[0].journalTransitions, []);
  assert.deepEqual(decisions[2].journalTransitions,
    ["VerifyingComposition", "Available"]);
  assert.deepEqual(decisions[3].journalTransitions, ["Available"]);
  assert.deepEqual(decisions[4].journalTransitions, ["Rejected"]);
  assert.deepEqual(decisions[5].journalTransitions, ["Rejected"]);
});

test("makes cancellation precedence narrow and fail-closed", () => {
  assert.equal(profile.cancellationRace.validPassWins, true);
  assert.equal(profile.cancellationRace.validNativeRejectionWins, true);
  assert.equal(profile.cancellationRace.noTerminalEvidenceBecomesCancelled, true);
  assert.equal(profile.cancellationRace.invalidTerminalEvidenceBecomesRejected, true);
  assert.equal(profile.cancellationRace.knownLiveProtocolViolationMayBeReconciledIntoPass,
    false);
  assert.deepEqual(profile.cancellationRace.examplesOfKnownLiveProtocolViolation, [
    "converter-timeout",
    "converter-output-limit",
    "converter-unexpected-stderr",
    "converter-executable-drift",
    "nonzero-exit-without-valid-native-rejection"
  ]);
});

test("covers every registered crash window and required fault class", () => {
  assert.equal(profile.crashWindows.length, 7);
  assert.deepEqual(profile.crashWindows.map((entry) => entry.window), [
    "before-intent-publication",
    "after-intent-publication-before-journal-transition",
    "after-converting-transition-before-or-during-process",
    "after-native-pass-before-managed-verification",
    "after-native-rejection-before-managed-rejection",
    "after-verifying-composition-transition-before-available",
    "after-terminal-journal-state"
  ]);
  assert.ok(profile.requiredTests.length >= 28);
  for (const required of [
    "operation-v1-is-not-read-or-migrated",
    "valid-pass-recovers-from-converting",
    "incomplete-root-stays-pending-with-no-journal-write",
    "pass-and-rejection-collision-is-rejected",
    "recovery-succeeds-after-original-source-and-converter-paths-are-unavailable",
    "known-live-protocol-violation-is-not-laundered-by-reconciliation",
    "public-errors-contain-no-private-paths"
  ]) {
    assert.ok(profile.requiredTests.includes(required), required);
  }
});

test("keeps structural recovery below every product and campaign gate", () => {
  assert.equal(profile.claimBoundary.fixtureEvidenceIsProductEvidence, false);
  assert.equal(profile.claimBoundary.terminalEvidenceMayBeRepaired, false);
  assert.equal(profile.claimBoundary.terminalEvidenceMayBeOverwritten, false);
  assert.ok(profile.claimBoundary.recoveredPassMayNotClaim.includes(
    "model-quality"));
  assert.ok(profile.claimBoundary.recoveredPassMayNotClaim.includes(
    "browser-chat"));
  assert.ok(profile.claimBoundary.recoveredPassMayNotClaim.includes(
    "campaign-credit"));
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("contains no credential or forbidden private drive reference", () => {
  const text = Buffer.concat([profileBytes, decisionBytes]).toString("utf8");
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(text, /[CD]:[\\/]/u);
});
