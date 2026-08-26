"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-result.v10.json");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v10.json");
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytes(commit, relativePath) {
  return childProcess.execFileSync("git",
    ["show", commit + ":" + relativePath], {
      cwd: repositoryRoot,
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true
    });
}

function currentText(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")),
    "utf8");
}

test("freezes execution /10 as one canonical terminal-failure result", () => {
  assert.equal(resultBytes.length, 18447);
  assert.equal(sha256(resultBytes),
    "6978a4f9f886c9a85e3d42aeab6b7a2b99ed5e3928e188de7536a122245b6d03");
  assert.equal(resultBytes.toString("utf8"), JSON.stringify(result, null, 2) + "\n");
  assert.equal(result.schema,
    "tinyrustlm.qwen3-real-composition-execution-result.v10");
  assert.equal(result.executionProfileId,
    "tinyrustlm.qwen3-real-composition-execution/10");
  assert.equal(result.executionId, profile.executionIdentity.executionId);
  assert.equal(result.status, "terminal-failure");
});

test("binds immutable /9 history and the exact remote /10 registration", () => {
  const predecessorBytes = fs.readFileSync(path.join(repositoryRoot,
    result.predecessor.resultPath));
  assert.equal(predecessorBytes.length, result.predecessor.resultByteLength);
  assert.equal(sha256(predecessorBytes), result.predecessor.resultSha256);
  assert.equal(result.predecessor.status, "terminal-ambiguous");
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
  assert.equal(result.registration.ownerProfileId,
    "tinyrustlm.qwen3-composition-verification-owner/1");
  assert.equal(result.registration.ownerSha256,
    "3a3894bf7a9a59b08b72e71a6d87e6f817c6e51fa1b67b2f6a60a9d70fe01c85");
  for (const [field, value] of Object.entries(result.registration)) {
    if (field.startsWith("remoteExact")) assert.equal(value, true, field);
  }
  assert.equal(result.registration.sourceChangedDuringExecution, false);
});

test("records one environment pass and two independently summarized custody passes",
  () => {
    const environment = result.windowsMsvcEnvironmentAuthority;
    assert.equal(environment.materialization.ownerInvocationCount, 1);
    assert.equal(environment.materialization.processExitCode, 0);
    assert.equal(environment.materialization.status, "pass");
    assert.equal(environment.evidence.publicLock.sha256,
      "c4cd7b3980ef15b4c0d63fd76a3878f28521dff4d2c6e03aa1982db3e6240437");
    assert.equal(environment.ownedApplicationDataRequired, true);

    for (const custody of [result.rustBuildCustody,
      result.managedBuildCustody]) {
      assert.equal(custody.profileId,
        "tinyrustlm.source-controlled-build-custody/4");
      assert.equal(custody.request.schema, "tinyrustlm.build-custody-request.v4");
      assert.equal(custody.execution.invocationCount, 1);
      assert.equal(custody.execution.processStarted, true);
      assert.equal(custody.execution.exitCode, 0);
      assert.equal(custody.terminal.status, "pass");
      assert.equal(custody.terminal.code, "build-custody-pass");
      assert.equal(custody.summary.schema, "tinyrustlm.build-custody-summary.v4");
      assert.equal(custody.summary.canonicalObservationMatched, true);
      assert.equal(custody.scratchInspection.invocationCount, 1);
      assert.equal(custody.scratchInspection.status, "pass");
      assert.equal(custody.scratchInspection.stderrEmpty, true);
      assert.equal(custody.custodyQualified, true);
      assert.equal(custody.retryAllowed, false);
      assert.equal(custody.outputAdoptionAllowed, false);
    }
  });

test("binds exact current Rust and managed required output identities", () => {
  assert.deepEqual(result.rustBuildCustody.targetInventory.requiredOutputs, [
    {
      relativePath:
        "x86_64-pc-windows-msvc/release/tinyrustlm-build-scratch-inspect.exe",
      byteLength: 240128,
      sha256: "c27d42943b288d841c3457cee15549744eb73a2b049f657a425beed0579720a6",
      peMachine: "0x8664"
    },
    {
      relativePath: "x86_64-pc-windows-msvc/release/tinyrustlm-convert.exe",
      byteLength: 852992,
      sha256: "0072dc9fa4e3c7361ee86a77fae16401fe298d274262f24a05e829c14f58c45b",
      peMachine: "0x8664"
    }
  ]);
  assert.equal(result.managedBuildCustody.targetInventory.fileCount, 19);
  assert.equal(result.managedBuildCustody.targetInventory.requiredOutputs.length,
    5);
  assert.equal(result.managedBuildCustody.targetInventory.requiredOutputs[1].sha256,
    "1af34f574619141c20c7e811bc18c1039ef41a1c6d46e7a88702ffd639872fe8");
  assert.equal(result.managedBuildCustody.targetInventory.requiredOutputs[3].sha256,
    "8cdfd9b0cd757e1e028080c817bc275b6c17b9dfcce224b5bf0894fa6b6f41ae");
  assert.equal(result.managedBuildCustody.scratchInspection
    .stagedHelperEqualsQualifiedRustOutput, true);
});

test("records one sole-owner invocation with no retry repair cleanup or adoption",
  () => {
    const execution = result.ownerExecution;
    assert.equal(execution.request.schema,
      "tinyrustlm.qwen3-composition-verification-request.v1");
    assert.equal(execution.request.byteLength, 11608);
    assert.equal(execution.request.sha256,
      "39b999970481e526c39e410a904e7c65cfb5f6a8a8cf22decfb904a00a0b50ec");
    assert.deepEqual(execution.preflight, {
      invocationCount: 1,
      status: "pass",
      evidenceRootAbsent: true,
      outputRootAbsent: true
    });
    assert.equal(execution.executionInvocationCount, 1);
    assert.equal(execution.converterLaunchCount, 1);
    assert.equal(execution.managedInspectionLaunchCount, 1);
    for (const field of [
      "automaticRetry",
      "manualRetryUnderRegistration",
      "bestOfN",
      "responseRepair",
      "evidenceOverwriteAllowed",
      "outputCleanupAllowed",
      "outputRepairAllowed",
      "outputAdoptionAllowed"
    ]) assert.equal(execution[field], false, field);
  });

test("preserves the exact unqualified ten-file candidate after converter pass",
  () => {
    const converter = result.converter;
    assert.equal(converter.pass, true);
    assert.equal(converter.exitCode, 0);
    assert.equal(converter.stderr.byteLength, 0);
    assert.equal(converter.outputCandidate.created, true);
    assert.equal(converter.outputCandidate.successInventoryCount, 10);
    assert.equal(converter.outputCandidate.inventory.length, 10);
    assert.equal(converter.outputCandidate.aggregateArtifactBytes,
      converter.outputCandidate.inventory.reduce(
        (sum, artifact) => sum + artifact.byteLength, 0));
    assert.deepEqual(converter.outputCandidate.inventory.find(
      artifact => artifact.file === "model.slm2"), {
      file: "model.slm2",
      byteLength: 598308416,
      sha256: "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7"
    });
    assert.deepEqual(converter.outputCandidate.inventory.find(
      artifact => artifact.file === "tokenizer.tokenizer2"), {
      file: "tokenizer.tokenizer2",
      byteLength: 7038773,
      sha256: "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b"
    });
    assert.equal(converter.outputCandidate.structurallyQualified, false);
    assert.equal(converter.outputCandidate.releasable, false);
    assert.equal(converter.outputCandidate.adoptionAllowed, false);
  });

test("records the sole managed inspection as a typed receipt-contract error",
  () => {
    const inspection = result.managedInspection;
    assert.equal(inspection.invocationCount, 1);
    assert.equal(inspection.processStarted, true);
    assert.equal(inspection.exitCode, 1);
    assert.equal(inspection.timedOut, false);
    assert.equal(inspection.stdout.byteLength, 0);
    assert.equal(inspection.stderr.byteLength, 136);
    assert.deepEqual(inspection.typedError, {
      schema: "tinyrustlm.qwen3-composition-managed-inspection-error.v1",
      status: "error",
      code: "converter-receipt-contract"
    });
    assert.equal(inspection.runtime.unchanged, true);
    assert.equal(inspection.assembly.unchanged, true);
    assert.equal(inspection.automaticRetry, false);
    assert.equal(inspection.manualRetryUnderRegistration, false);
  });

test("proves the registered producer and verifier disagreed on durability semantics",
  () => {
    const defect = result.receiptContractDefect;
    assert.equal(defect.rootCauseEstablished, true);
    assert.equal(defect.reasonCode, "managed-verifier-durability-contract-drift");
    assert.equal(defect.producerObservation.durabilityOperationId,
      defect.producerObservation.operationId + "-members");
    assert.equal(defect.producerObservation.durabilityStatus, "performed");
    assert.equal(defect.registeredManagedVerifierSource
      .requiredDurabilityOperationId, "parent-operation-id");
    assert.equal(defect.registeredManagedVerifierSource
      .requiredDurabilityStatus, "flushed");

    for (const identity of [
      ...defect.registeredProducerSources,
      defect.registeredManagedVerifierSource
    ]) {
      const bytes = gitBytes(result.registration.commit, identity.path);
      assert.equal(bytes.length, identity.byteLength);
      assert.equal(sha256(bytes), identity.sha256);
    }

    const producer = gitBytes(result.registration.commit,
      defect.registeredProducerSources[0].path).toString("utf8");
    const durability = gitBytes(result.registration.commit,
      defect.registeredProducerSources[1].path).toString("utf8");
    const verifier = gitBytes(result.registration.commit,
      defect.registeredManagedVerifierSource.path).toString("utf8");
    assert.match(producer,
      /&format!\("\{\}-members", output\.operation_id\)/u);
    assert.match(durability, /status: "performed"\.to_owned\(\)/u);
    assert.match(verifier,
      /receipt\.Durability\.OperationId != receipt\.OperationId/u);
    assert.match(verifier,
      /receipt\.Durability\.Status != "flushed"/u);
  });

test("clean-cuts the managed verifier to the producer contract with negative fixtures",
  () => {
    assert.deepEqual(result.failureDrivenCorrection, {
      appliedOnlyAfterTerminalFailure: true,
      producerChanged: false,
      managedVerifierRequiresParentPlusMembersSuffix: true,
      managedVerifierRequiresPerformedStatus: true,
      fixturePassShapeMatchesProducer: true,
      wrongParentOperationIdNegativeFixtureAdded: true,
      wrongFlushedStatusNegativeFixtureAdded: true,
      compatibilityAcceptanceAdded: false,
      fallbackAdded: false,
      resultRepairsExecution: false,
      newRegistrationRequired: true,
      whollyNewPrivateNamesRequired: true
    });

    const verifier = currentText(
      "dotnet/src/TinyRustLM.Conversion/TinyRustLmConversionTool.cs");
    assert.match(verifier,
      /MembersDurabilityOperationSuffix = "-members"/u);
    assert.match(verifier, /PerformedDurabilityStatus = "performed"/u);
    assert.match(verifier,
      /receipt\.Durability\.Status != PerformedDurabilityStatus/u);
    assert.doesNotMatch(verifier,
      /receipt\.Durability\.OperationId != receipt\.OperationId \|\|/u);
    assert.doesNotMatch(verifier,
      /receipt\.Durability\.Status != "flushed"/u);

    const fixture = currentText(
      "dotnet/tools/TinyRustLM.ConversionFixtureTool/Program.cs");
    const tests = currentText(
      "dotnet/tests/TinyRustLM.Core.Tests/ConversionToolTests.cs");
    assert.match(fixture, /scenario == "durability-operation"/u);
    assert.match(fixture, /scenario == "durability-status"/u);
    assert.match(fixture, /operationId\}-members/u);
    assert.match(tests,
      /\[InlineData\("durability-operation", "converter-receipt-contract"\)\]/u);
    assert.match(tests,
      /\[InlineData\("durability-status", "converter-receipt-contract"\)\]/u);
  });

test("binds exact private terminal verification and one read-only reproduction",
  () => {
    assert.deepEqual(result.privateVerification, {
      schema: "tinyrustlm.qwen3-composition-execution-verification.v6",
      byteLength: 7775,
      sha256: "798d986531769156455f2e40398803b92777d45695d2b66b0bb1bd2205c423a5",
      status: "terminal-failure",
      reasonCode: "managed-inspection-process-not-pass",
      evidenceFileCountBeforeVerification: 9,
      finalEvidenceFileCount: 10,
      outputFileCount: 10,
      structuralCompositionVerified: false,
      candidateBytesMayAdvanceToNumericalParity: false,
      readOnlyVerificationInvocationCount: 1,
      readOnlyVerificationReproducedExactDecision: true,
      readOnlyVerificationLaunchedMaterialProcess: false,
      readOnlyVerificationWroteEvidence: false,
      privatePathPublished: false
    });
  });

test("closes /10 without retry cleanup repair adoption parity or release", () => {
  assert.deepEqual(result.decision, {
    status: "terminal-failure",
    reasonCode: "managed-inspection-process-not-pass",
    registrationClosed: true,
    structuralCompositionVerified: false,
    candidateBytesMayAdvanceToNumericalParity: false,
    candidateBytesMayBeReleased: false,
    retryUnderRegistrationAllowed: false,
    existingPrivateEvidenceMayBeDeleted: false,
    existingPrivateEvidenceMayBeOverwritten: false,
    existingOutputMayBeRepaired: false,
    existingOutputMayBeAdopted: false,
    newAttemptRequiresNewRegistrationAndAllNewLogicalNames: true
  });
});

test("publishes no private material secret or inflated campaign claim", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text, /TinyRustLM-vnext-private/iu);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  const permittedTrueClaims = new Set([
    "realConversionAttemptRegistered",
    "msvcEnvironmentAuthorityMaterialized",
    "rustBuildCustodyCompleted",
    "rustScratchInspectionPassed",
    "managedBuildCustodyCompleted",
    "managedScratchInspectionPassed",
    "compositionOwnerInvoked",
    "realConverterInvoked",
    "converterExitedZero",
    "compositionCandidateCreated",
    "managedInspectionInvoked",
    "finalVerificationCreated",
    "readOnlyVerificationReproduced"
  ]);
  for (const [field, value] of Object.entries(result.claimBoundary)) {
    assert.equal(value, permittedTrueClaims.has(field), field);
  }
  assert.deepEqual(result.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});
