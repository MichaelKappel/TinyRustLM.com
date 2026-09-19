"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-result.v12.json");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v12.json");
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));
const durableMemoryRelativePath =
  "wiki/runtime-mirust/reports/" +
  "tinyrustlm-qwen3-composition-v12-structural-pass-memory-2026-08-26.md";
const durableMemoryBytes = fs.readFileSync(path.join(repositoryRoot,
  durableMemoryRelativePath));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytes(commit, relativePath) {
  return childProcess.execFileSync("git", ["show", commit + ":" + relativePath], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
}

test("freezes execution /12 as one canonical structural pass", () => {
  assert.equal(resultBytes.length, 18441);
  assert.equal(sha256(resultBytes),
    "0c3e84ad9ce6e22d9a164357c9a900d31825d0639f4f11077dab305f9cf3ef0e");
  assert.equal(resultBytes.toString("utf8"), JSON.stringify(result, null, 2) + "\n");
  assert.equal(result.schema,
    "tinyrustlm.qwen3-real-composition-execution-result.v12");
  assert.equal(result.executionProfileId,
    "tinyrustlm.qwen3-real-composition-execution/12");
  assert.equal(result.executionId, profile.executionIdentity.executionId);
  assert.equal(result.status, "structural-pass");
});

test("binds terminal /11 and the exact remote /12 registration", () => {
  const predecessor = fs.readFileSync(path.join(repositoryRoot,
    result.predecessor.resultPath));
  assert.equal(predecessor.length, result.predecessor.resultByteLength);
  assert.equal(sha256(predecessor), result.predecessor.resultSha256);
  assert.equal(result.predecessor.status, "terminal-managed-preflight-rejection");
  assert.equal(result.predecessor.reused, false);
  assert.equal(result.predecessor.modified, false);

  assert.equal(profileBytes.length, result.registration.profileByteLength);
  assert.equal(sha256(profileBytes), result.registration.profileSha256);
  assert.deepEqual(gitBytes(result.registration.commit,
    result.registration.profilePath), profileBytes);
  assert.equal(childProcess.execFileSync("git",
    ["rev-parse", result.registration.commit + "^{tree}"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true
    }).trim(), result.registration.tree);
  assert.equal(result.registration.parentCommit,
    childProcess.execFileSync("git", ["rev-parse", result.registration.commit + "^"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true
    }).trim());
  assert.equal(result.registration.registrationFourWayRemoteExact, true);
  assert.equal(result.registration.allSeventeenRegisteredNamesAbsentAfterRemoteProof, true);
  assert.equal(result.registration.sourceChangedDuringExecution, false);
});

test("retains the pre-write guard without assigning operation authority", () => {
  assert.deepEqual(result.operatorPreparationObservation, {
    preWriteShapeGuardRejectionObserved: true,
    code: "msvc-environment-prohibited-root",
    cause: "in-memory-drive-d-string-escaping",
    registeredPathOpened: false,
    registeredFileCreated: false,
    registeredOwnerInvoked: false,
    registeredInvocationConsumed: false,
    operationOutcomeAuthority: false,
    hidden: false
  });
});

test("records exact materializer and two custody passes", () => {
  assert.equal(result.windowsMsvcEnvironmentAuthority.materialization.ownerInvocationCount, 1);
  assert.equal(result.windowsMsvcEnvironmentAuthority.materialization.status, "pass");
  assert.equal(result.windowsMsvcEnvironmentAuthority.readOnlyValidation.status, "pass");
  assert.equal(result.requestMaterializer.rust.materializerInvocationCount, 1);
  assert.equal(result.requestMaterializer.managed.materializerInvocationCount, 1);
  assert.equal(result.requestMaterializer.genericFlatteningUsed, false);
  assert.equal(result.requestMaterializer.adHocTransformationUsed, false);

  for (const custody of [result.rustBuildCustody, result.managedBuildCustody]) {
    assert.equal(custody.preflight.invocationCount, 1);
    assert.equal(custody.preflight.status, "ready");
    assert.equal(custody.execution.invocationCount, 1);
    assert.equal(custody.execution.processStarted, true);
    assert.equal(custody.execution.exitCode, 0);
    assert.equal(custody.terminal.status, "pass");
    assert.equal(custody.summary.schema, "tinyrustlm.build-custody-summary.v4");
    assert.equal(custody.scratchInspection.invocationCount, 1);
    assert.equal(custody.scratchInspection.status, "pass");
    assert.equal(custody.custodyQualified, true);
    assert.equal(custody.retryAllowed, false);
    assert.equal(custody.outputAdoptionAllowed, false);
  }
  const rustHelper = result.rustBuildCustody.targetInventory.requiredOutputs[0];
  const managedHelper = result.managedBuildCustody.targetInventory.requiredOutputs[4];
  assert.equal(managedHelper.byteLength, rustHelper.byteLength);
  assert.equal(managedHelper.sha256, rustHelper.sha256);
  assert.equal(result.managedBuildCustody.scratchInspection
    .stagedHelperEqualsQualifiedRustOutput, true);
});

test("records one converter and one independent managed structural pass", () => {
  assert.equal(result.ownerExecution.preflight.invocationCount, 1);
  assert.equal(result.ownerExecution.preflight.status, "pass");
  assert.equal(result.ownerExecution.executionInvocationCount, 1);
  assert.equal(result.ownerExecution.converterLaunchCount, 1);
  assert.equal(result.ownerExecution.managedInspectionLaunchCount, 1);
  assert.equal(result.ownerExecution.automaticRetry, false);
  assert.equal(result.ownerExecution.bestOfN, false);
  assert.equal(result.ownerExecution.responseRepair, false);

  assert.equal(result.converter.pass, true);
  assert.equal(result.converter.processStarted, true);
  assert.equal(result.converter.exitCode, 0);
  assert.equal(result.managedInspection.invocationCount, 1);
  assert.equal(result.managedInspection.processStarted, true);
  assert.equal(result.managedInspection.exitCode, 0);
  assert.equal(result.managedInspection.pass, true);
  assert.equal(result.managedInspection.rejected, false);
  assert.equal(result.managedInspection.reasonCode,
    "managed-structural-inspection-pass");
  assert.equal(result.managedInspection.result.graphIdentitySha256,
    result.converter.summary.graphIdentitySha256);
});

test("binds the exact ten-file composition and six semantic members", () => {
  const composition = result.composition;
  assert.equal(composition.outputFileCount, 10);
  assert.equal(composition.inventory.length, 10);
  assert.equal(composition.inventory.reduce((sum, entry) => sum + entry.byteLength, 0),
    composition.aggregateByteLength);
  assert.deepEqual(composition.inventory.map((entry) => entry.file),
    [...composition.inventory.map((entry) => entry.file)].sort());
  assert.equal(new Set(composition.inventory.map((entry) => entry.file)).size, 10);
  assert.deepEqual(composition.semanticMembers, [
    "model.slm2",
    "tokenizer.tokenizer2",
    "template.template2",
    "sampling.sampling2",
    "prompt.prompt2",
    "composition.acg2"
  ]);
  for (const file of composition.semanticMembers) {
    assert.ok(composition.inventory.some((entry) => entry.file === file), file);
  }
  assert.equal(composition.newlyMaterializedByExecution12, true);
  assert.equal(composition.priorFailedCandidateAdopted, false);
  assert.equal(composition.matchingHashesAuthorizePriorByteAdoption, false);
});

test("reproduces the structural decision read-only and advances only to parity", () => {
  const verification = result.privateVerification;
  assert.equal(verification.status, "pass");
  assert.equal(verification.reasonCode, "structural-composition-verified");
  assert.equal(verification.evidenceFileCountBeforeVerification, 9);
  assert.equal(verification.finalEvidenceFileCount, 10);
  assert.equal(verification.outputFileCount, 10);
  assert.equal(verification.readOnlyVerificationInvocationCount, 1);
  assert.equal(verification.readOnlyVerificationReproducedExactDecision, true);
  assert.equal(verification.readOnlyVerificationLaunchedMaterialProcess, false);
  assert.equal(verification.readOnlyVerificationWroteEvidence, false);

  assert.equal(result.decision.status, "pass");
  assert.equal(result.decision.registrationClosed, true);
  assert.equal(result.decision.structuralCompositionVerified, true);
  assert.equal(result.decision.candidateBytesMayAdvanceToNumericalParity, true);
  assert.equal(result.decision.candidateBytesMayBeReleased, false);
  assert.equal(result.decision.nextRequiredGate,
    "source-framework-and-scalar-native-numerical-parity");
});

test("publishes no private path secret or inflated product claim", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text, /TinyRustLM-vnext-private/iu);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  const trueClaims = new Set([
    "realConversionAttemptRegistered",
    "msvcEnvironmentAuthorityMaterialized",
    "rustCustodyIntentCreated",
    "rustCustodyRequestMaterialized",
    "rustBuildCustodyCompleted",
    "rustScratchInspectionPassed",
    "managedCustodyIntentCreated",
    "managedCustodyRequestMaterialized",
    "managedBuildCustodyCompleted",
    "managedScratchInspectionPassed",
    "compositionRequestCreated",
    "compositionOwnerPreflightPassed",
    "compositionOwnerInvoked",
    "realConverterInvoked",
    "converterExitedZero",
    "compositionCandidateCreated",
    "managedInspectionInvoked",
    "managedInspectionPassed",
    "finalVerificationCreated",
    "readOnlyVerificationReproduced",
    "structuralCompositionVerified"
  ]);
  for (const [field, value] of Object.entries(result.claimBoundary)) {
    assert.equal(value, trueClaims.has(field), field);
  }
  assert.deepEqual(result.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("routes one checksum-bound durable memory through canonical UAI memory", () => {
  assert.equal(durableMemoryBytes.length, 11584);
  assert.equal(sha256(durableMemoryBytes),
    "2a1c2882b9368d0ebd45fe96b9689406d5fcbfd941b4b2a5b39868da5cb3e1cf");
  const memoryText = durableMemoryBytes.toString("utf8");
  for (const required of [
    "docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md",
    "tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26.md",
    "tinyrustlm-post-v10-native-browser-release-intake-tdd-delta-2026-08-26.md",
    "tinyrustlm-post-v10-native-browser-release-intake-memory-2026-08-26.md"
  ]) {
    assert.ok(memoryText.includes(required), required);
  }
  assert.match(memoryText,
    /source-framework\s+and\s+scalar-native\s+numerical\s+parity/u);
  const canonicalRoute =
    "wiki/runtime-mirust/reports/" +
    "tinyrustlm-working-product-memory-2026-09-19.md";
  const decisionRoute =
    "wiki/runtime-mirust/reports/" +
    "tinyrustlm-report-intake-decision-index-2026-09-19.md";
  for (const relativePath of [
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
  ]) {
    const uaiText = fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
    assert.ok(uaiText.includes(canonicalRoute), relativePath);
    assert.ok(uaiText.includes(decisionRoute), relativePath);
  }
  const canonicalText = fs.readFileSync(path.join(repositoryRoot, canonicalRoute), "utf8");
  assert.ok(canonicalText.includes(durableMemoryRelativePath));
});
