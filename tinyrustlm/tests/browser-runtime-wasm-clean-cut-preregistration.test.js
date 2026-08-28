"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot,
  "contracts/vnext/browser-runtime-wasm-clean-cut-preregistration.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readBoundFile(identity) {
  const bytes = fs.readFileSync(path.join(repositoryRoot, identity.path));
  if (Object.hasOwn(identity, "byteLength")) {
    assert.equal(bytes.length, identity.byteLength, identity.path);
  }
  assert.equal(sha256(bytes), identity.sha256, identity.path);
}

test("binds the clean source parent and sole browser runtime owners", () => {
  assert.equal(profile.schema,
    "tinyrustlm.browser-runtime-wasm-clean-cut-preregistration.v1");
  assert.equal(profile.status,
    "raw-wasm-and-worker-implemented-real-chromium-boundary-verified-ui-pending");
  assert.equal(profile.registrationParentCommit,
    "cf56eb1a563c85acfc7257d128f5fe3b386da954");
  assert.equal(profile.registrationParentTree,
    "00e364b0b1b71a458c749f16c720ca5bc3f4073f");
  assert.equal(profile.authority.productLifecycle,
    "prelaunch-single-product");
  assert.equal(profile.authority.implementationPath,
    "rust/crates/tinyrustlm-browser-runtime-wasm");
  assert.equal(profile.authority.workerPath,
    "tinyrustlm/app/model-runtime-worker.js");
  assert.equal(profile.authority.uiPath, "tinyrustlm/app/app.js");
  readBoundFile(profile.authority.cleanCutContract);
  readBoundFile(profile.authority.cleanCutArchitecture);
  profile.authority.canonicalFormatAuthorities.forEach(readBoundFile);
  assert.deepEqual(profile.correction, {
    observedAtUtc: "2026-08-27T23:23:50Z",
    stage: "raw-wasm-real-artifact-preflight-before-worker-implementation",
    reasonCode: "browser-runtime-sampling2-size-contract-mismatch",
    priorRegistration: {
      commit: "62095be274b316b290e78fc2163ab3235fd2a2ef",
      byteLength: 15879,
      sha256: "be26574af30dbf587d1d9b32e0926e8f01aa329f3a346a817b61a3c2914765f8"
    },
    observedPublicFacts: {
      sampling2ProfileExactBytes: 65800,
      prompt2ProfileExactBytes: 512,
      priorSamplingTransferMaximumBytes: 65536,
      priorPromptTransferMaximumBytes: 65536
    },
    disposition: "replace-defective-current-contract-with-canonical-profile-sizes",
    compatibilityBehaviorAdded: false,
    campaignCreditAuthorized: false
  });
  assert.deepEqual(profile.workerProtocolClosure, {
    registeredAtUtc: "2026-08-27T23:44:01Z",
    stage: "output-free-worker-protocol-preflight-before-worker-source",
    reasonCode: "browser-runtime-worker-command-event-vocabulary-underspecified",
    priorCurrentContract: {
      commit: "9b7f25a235315b1a97dfc54e47e133b3e8ea0eb1",
      byteLength: 18804,
      sha256: "a62cb50abe1ceb616a1d666f6a1364f953cf1b0134c82f38617a235369a128cb"
    },
    disposition: "close-command-event-payload-sequence-and-failure-semantics",
    workerSourceExistedAtRegistration: false,
    genericInvokeCommandAllowed: false,
    compatibilityBehaviorAdded: false,
    campaignCreditAuthorized: false
  });
  assert.deepEqual(profile.workerProtocolPrecisionClosure, {
    registeredAtUtc: "2026-08-27T23:52:00Z",
    stage: "output-free-result-and-payload-preflight-before-worker-source",
    reasonCode: "browser-runtime-u64-json-number-is-not-lossless-in-javascript",
    priorCurrentContract: {
      commit: "ed531e251762b697e9195bcb4b7273a6505fab14",
      byteLength: 25672,
      sha256: "c74ce60ff99ba69ab49a266883b3838dfa463de96d9466194ca20485314b7941"
    },
    disposition: "encode-transcript-revision-as-two-unsigned32-state-fields-and-close-payload-types",
    workerSourceExistedAtRegistration: false,
    lossyJsonNumberAllowed: false,
    compatibilityBehaviorAdded: false,
    campaignCreditAuthorized: false
  });
  assert.equal(profile.workerImplementationEvidence.observedAtUtc,
    "2026-08-28T00:20:20Z");
  assert.equal(profile.workerImplementationEvidence.stage,
    "worker-boundary-real-browser-closure-before-ui-integration");
  assert.equal(profile.workerImplementationEvidence.implementationCommit,
    "6ff375bc3ef4177ebcf0a3e3c1129e1d6902cb25");
  assert.equal(profile.workerImplementationEvidence.implementationTree,
    "1230988c18391d1cc0a3fa776a1d4b1443eb7ca1");
  profile.workerImplementationEvidence.boundFiles.forEach(readBoundFile);
  assert.deepEqual(profile.workerImplementationEvidence.focusedNodeTests, {
    command: "node --test tests/browser-runtime-wasm-clean-cut-preregistration.test.js tests/browser-runtime-wasm-raw-abi.test.js tests/model-runtime-worker.test.js tests/model-runtime-worker-browser.test.js",
    passed: 31,
    failed: 0
  });
  assert.equal(profile.workerImplementationEvidence.realBrowser
    .ownedFreshProfilesCreatedAndDeleted, 2);
  assert.equal(profile.workerImplementationEvidence.realBrowser
    .successfulInitializeReleaseLifetimes, 2);
  assert.equal(profile.workerImplementationEvidence.realBrowser
    .terminalInitializationRejectionsDelivered, 2);
  assert.equal(profile.workerImplementationEvidence.browserRequirements
    .contentSecurityPolicyScriptCapability, "wasm-unsafe-eval");
  assert.equal(profile.workerImplementationEvidence.browserRequirements
    .sameCallbackPostThenCloseAllowed, false);
  assert.equal(profile.workerImplementationEvidence.uiIntegrationComplete, false);
  assert.equal(profile.workerImplementationEvidence.supersededBrowserPathDeleted, false);
  assert.equal(profile.workerImplementationEvidence.compatibilityBehaviorAdded, false);
  assert.equal(profile.workerImplementationEvidence.campaignCreditAuthorized, false);
});

test("defines one worker-owned runtime with no direct UI authority", () => {
  const owner = profile.singleOwner;
  assert.equal(owner.moduleInstanceCountPerWorker, 1);
  assert.equal(owner.runtimeInstanceCountPerModule, 1);
  assert.equal(owner.workerOwnsModuleAndRuntime, true);
  assert.equal(owner.uiMayCallWasmDirectly, false);
  assert.equal(owner.uiMayOwnModelBytes, false);
  assert.equal(owner.uiMayOwnKvState, false);
  assert.equal(owner.uiMayRepairModelOutput, false);
  assert.equal(owner.workerTerminationInvalidatesRuntimeAndKv, true);
  assert.equal(owner.freshWorkerMustReverifyEveryMemberBeforeActivation, true);
});

test("closes the exact ACG2 member set and transactional activation", () => {
  const artifact = profile.artifactContract;
  assert.equal(artifact.compositionProfile, "org.minimodel.acg2/2.0");
  assert.equal(artifact.compositionBytes, 896);
  assert.equal(artifact.memberCount, 5);
  assert.deepEqual(artifact.requiredMembers.map((member) => member.role),
    ["model", "tokenizer", "template", "sampling", "prompt"]);
  assert.deepEqual(artifact.requiredMembers.map((member) => member.format),
    ["slm2", "tokenizer2", "template2", "sampling2", "prompt2"]);
  assert.equal(artifact.unknownMembersAllowed, false);
  assert.equal(artifact.duplicateMembersAllowed, false);
  assert.equal(artifact.pathOrUrlAuthorityInsideWasm, false);
  assert.equal(artifact.activationIsTransactional, true);
  assert.equal(artifact.failedActivationPreservesCurrentRuntime, true);
  assert.equal(artifact.failedActivationCandidateIsRetained, false);
});

test("requires move-only bounded transfers without a second model owner", () => {
  const transfer = profile.transferProtocol;
  assert.equal(transfer.pendingTransferCountMaximum, 1);
  assert.equal(transfer.committedValueCountPerKindMaximum, 1);
  assert.equal(transfer.commitCopiesBytes, false);
  assert.equal(transfer.duplicateCommittedKindReplacesExisting, false);
  assert.equal(transfer.modelOwnershipMovesIntoCanonicalRuntime, true);
  assert.equal(transfer.modelTransferBytesRemainRetainedAfterSuccessfulActivation,
    false);
  assert.equal(transfer.unboundedSecondModelCopyAllowed, false);
  assert.equal(transfer.runtimeRepackingAllowed, false);
  assert.equal(transfer.javascriptModelBufferMustBeReleasedAfterCommit, true);
  assert.equal(transfer.workerMessageTransferListRequiredForBinaryChunks, true);

  const kinds = transfer.transferKinds;
  assert.equal(kinds.length, 9);
  assert.deepEqual(kinds.map((entry) => entry.code), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(new Set(kinds.map((entry) => entry.name)).size, kinds.length);
  assert.equal(kinds.find((entry) => entry.name === "expected-operation").exactBytes,
    32);
  assert.equal(kinds.find((entry) => entry.name === "next-operation").exactBytes,
    32);
  assert.equal(kinds.find((entry) => entry.name === "composition").exactBytes,
    896);
  assert.equal(kinds.find((entry) => entry.name === "sampling").exactBytes,
    65800);
  assert.equal(kinds.find((entry) => entry.name === "prompt").exactBytes,
    512);
});

test("freezes a closed raw ABI and stable status classes", () => {
  const names = profile.exports.map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names, [
    "tinyrustlm_browser_runtime_abi_version",
    "tinyrustlm_browser_runtime_transfer_begin",
    "tinyrustlm_browser_runtime_transfer_commit",
    "tinyrustlm_browser_runtime_transfer_cancel",
    "tinyrustlm_browser_runtime_create",
    "tinyrustlm_browser_runtime_activate",
    "tinyrustlm_browser_runtime_advance_operation",
    "tinyrustlm_browser_runtime_set_transcript",
    "tinyrustlm_browser_runtime_begin_request",
    "tinyrustlm_browser_runtime_step",
    "tinyrustlm_browser_runtime_finish",
    "tinyrustlm_browser_runtime_release",
    "tinyrustlm_browser_runtime_result_ptr",
    "tinyrustlm_browser_runtime_result_len",
    "tinyrustlm_browser_runtime_error_ptr",
    "tinyrustlm_browser_runtime_error_len"
  ]);
  assert.deepEqual(profile.statusCodes, [
    { code: 0, name: "ok" },
    { code: 1, name: "boundary-rejected" },
    { code: 2, name: "runtime-rejected" },
    { code: 3, name: "internal-failure" }
  ]);
});

test("bounds every runtime resource before immutable policy creation", () => {
  const policy = profile.runtimePolicy;
  assert.equal(policy.allByteArgumentsAreUnsigned32, true);
  assert.equal(policy.transcriptRevisionIsUnsigned64FromLowHighWords, true);
  assert.equal(policy.allLimitsMustBePositive, true);
  assert.equal(policy.maximumModelBytesHardCeiling, 2147483648);
  assert.equal(policy.maximumSequenceTokensHardCeiling, 40960);
  assert.equal(policy.maximumKvBytesHardCeiling, 2147483648);
  assert.equal(policy.maximumScratchBytesHardCeiling, 1073741824);
  assert.equal(policy.maximumResolvedMemberBytesHardCeiling, 2281701376);
  assert.equal(policy.maximumResidentDependencyBytesHardCeiling, 134217728);
  assert.equal(policy.maximumRequestBytesHardCeiling, 16777216);
  assert.equal(policy.maximumLinearMemoryBytesHardCeiling, 3221225472);
  assert.equal(policy.policyCannotChangeAfterCreate, true);
  assert.equal(policy.runtimeCannotBeCreatedTwiceWithoutRelease, true);
  assert.equal(policy.artifactsCannotBeAllocatedBeforeCreate, true);
  assert.equal(policy.resourcePreflightOccursBeforeRuntimeMutation, true);
});

test("binds the opt-in private structural activation without granting product credit", () => {
  const activation = profile.privateStructuralActivation;
  readBoundFile(activation.publicResult);
  assert.equal(activation.optInEnvironmentVariable,
    "TINYRUSTLM_BROWSER_RUNTIME_PRIVATE_COMPOSITION_ROOT");
  assert.deepEqual(activation.semanticMembers, [
    "model.slm2",
    "tokenizer.tokenizer2",
    "template.template2",
    "sampling.sampling2",
    "prompt.prompt2",
    "composition.acg2"
  ]);
  assert.match(activation.operationIdHex, /^[a-f0-9]{64}$/u);
  assert.deepEqual(activation.expectedMemoryPlan, {
    modelBytes: 598308416,
    kvBytes: 917504,
    scratchBytes: 673296
  });
  assert.equal(activation.privatePathMayEnterSourceOrOutput, false);
  assert.equal(activation.privateBytesMayEnterSourceOrOutput, false);
  assert.equal(activation.browserConversationVerified, false);
  assert.equal(activation.modelQualityVerified, false);
  assert.equal(activation.campaignCreditAuthorized, false);
});

test("binds every mutation to one expected operation and one terminal output", () => {
  const operations = profile.operationRules;
  assert.equal(operations.everyMutatingRuntimeCallConsumesExpectedOperation, true);
  assert.equal(operations.zeroOperationRejected, true);
  assert.equal(operations.staleExpectedOperationRejectedBeforeMutation, true);
  assert.equal(operations.expectedOperationNeverBecomesNextOperationImplicitly,
    true);
  assert.equal(operations.successfulActivationPreservesCurrentOperation, true);
  assert.equal(operations.compositionIdentityIsNeverOperationAuthority, true);
  assert.equal(operations.modelSwitchRequiresExplicitOperationAdvanceBeforeActivation,
    true);
  assert.equal(operations.advanceRequiresDistinctNonzeroNextOperation, true);
  assert.equal(operations.failedAdvancePreservesCurrentOperation, true);
  assert.equal(operations.cancellationNeverStartsReplacementGeneration, true);

  const result = profile.resultContract;
  assert.equal(result.outputTextIsRawCanonicalRuntimeDecode, true);
  assert.equal(result.outputMayBeRepaired, false);
  assert.equal(result.outputMayBeRetriedAutomatically, false);
  assert.equal(result.outputMayBeSelectedBestOfN, false);
  assert.equal(result.finishConsumesTerminalOutputExactlyOnce, true);
  assert.equal(result.secondFinishRejects, true);
  assert.deepEqual(result.stateTranscriptRevisionEncoding, {
    fields: ["transcriptRevisionLow", "transcriptRevisionHigh"],
    eachFieldIsUnsigned32: true,
    combinedJsonNumberAllowed: false,
    combinedDecimalStringAllowed: false
  });
});

test("closes worker ordering, binary ownership, and network authority", () => {
  const worker = profile.workerProtocol;
  assert.equal(worker.schema, "tinyrustlm.model-runtime-worker/1");
  assert.equal(worker.unknownFieldsAllowed, false);
  assert.equal(worker.idsAreLowercaseHexSha256, true);
  assert.equal(worker.sequenceStartsAtZero, true);
  assert.equal(worker.sequenceMustIncreaseByOne, true);
  assert.equal(worker.duplicateMessageRejected, true);
  assert.equal(worker.outOfOrderMessageRejected, true);
  assert.equal(worker.staleWorkerRejected, true);
  assert.equal(worker.staleOperationRejected, true);
  assert.equal(worker.staleCompositionRejected, true);
  assert.equal(worker.staleGenerationRejected, true);
  assert.equal(worker.completionCountPerGeneration, 1);
  assert.equal(worker.uiAssistantRenderCountPerCompletion, 1);
  assert.equal(worker.repeatedTokenTextIsNotDeduplicated, true);
  assert.equal(worker.binaryPayloadUsesTransferableArrayBuffer, true);
  assert.deepEqual(worker.sequenceDomains, {
    command: { startsAt: 0, increment: 1, maximumAcceptedMessages: 65536 },
    event: { startsAt: 0, increment: 1, maximumEmittedMessages: 65536 }
  });
  assert.equal(worker.maximumBinaryChunkBytes, 4 * 1024 * 1024);
  assert.equal(worker.workerWipesAcceptedChunkAfterWasmCopy, true);
  assert.equal(worker.workerRetainsWholeModelArrayBuffer, false);
  assert.equal(worker.wasmModuleMaximumBytes, 16 * 1024 * 1024);
  assert.equal(worker.wasmModuleSha256RequiredAndRecomputed, true);
  assert.deepEqual(worker.wasmModuleImportsAllowed, []);
  assert.equal(worker.wasmModuleMaximumMemoryBytes, 3 * 1024 * 1024 * 1024);
  assert.equal(worker.payloadScalarRules.transcriptRevisionWords, "unsigned32");
  assert.equal(worker.payloadScalarRules.artifactChunkBytes,
    "transferable-array-buffer-1-to-4194304-bytes");
  assert.equal(worker.payloadScalarRules.emptyPayload,
    "plain-object-with-zero-own-keys");
  assert.deepEqual(worker.artifactKinds.map((entry) => entry.name), [
    "model",
    "tokenizer",
    "template",
    "sampling",
    "prompt",
    "composition",
    "prompt-request"
  ]);
  assert.deepEqual(worker.artifactKinds.map((entry) => entry.transferCode),
    [3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(worker.commands.map((entry) => entry.kind), [
    "initialize",
    "artifact-begin",
    "artifact-chunk",
    "artifact-commit",
    "activate",
    "advance-operation",
    "set-transcript",
    "begin-generation",
    "step-generation",
    "cancel-generation",
    "release"
  ]);
  assert.deepEqual(worker.events.map((entry) => entry.kind), [
    "runtime-ready",
    "artifact-transfer-begun",
    "artifact-chunk-accepted",
    "artifact-transfer-committed",
    "composition-active",
    "operation-advanced",
    "transcript-updated",
    "generation-begun",
    "generation-step",
    "generation-complete",
    "runtime-released",
    "command-rejected"
  ]);
  assert.equal(worker.genericInvokeCommandAllowed, false);
  assert.equal(worker.expectedAndNextOperationTransfersAreWorkerInternal, true);
  assert.equal(worker.terminalStepFinishesInsideWorker, true);
  assert.equal(worker.separateFinishCommandAllowed, false);
  assert.deepEqual(worker.eventMessageId.canonicalUtf8Fields, [
    "domain",
    "workerId",
    "commandMessageId",
    "eventSequenceDecimal",
    "eventKind"
  ]);
  assert.equal(worker.invalidEnvelopeOrStaleIdentityTerminatesWithoutProtocolEvent,
    true);
  assert.equal(worker.wasmTrapTerminatesWorkerAndInvalidatesKv, true);
  assert.equal(worker.freshWorkerReverifiesEveryImmutableMember, true);
  assert.deepEqual(worker.networkGlobalsDisabledBeforeMessageAcceptance, [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "WebTransport",
    "RTCPeerConnection",
    "importScripts"
  ]);
  assert.equal(worker.workerMayAccessNetwork, false);
  assert.equal(worker.workerMayReceiveArbitraryUrlOrPath, false);
});

test("forbids browser compatibility paths and fake success", () => {
  const obsolete = profile.obsoleteBrowserClosure;
  assert.equal(obsolete.compatibilityReaderAllowed, false);
  assert.equal(obsolete.compatibilityWriterAllowed, false);
  assert.equal(obsolete.dualRuntimeAllowed, false);
  assert.equal(obsolete.fallbackToSupersededRuntimeAllowed, false);
  assert.equal(obsolete.featureFlagForSupersededRuntimeAllowed, false);
  assert.ok(obsolete.deleteAfterReplacement.includes("tinyrustlm/runtime"));

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
});

test("keeps the registration bounded and public safe", () => {
  assert.ok(profileBytes.length > 4096);
  assert.ok(profileBytes.length <= 32768);
  assert.doesNotMatch(profileBytes.toString("utf8"),
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(profileBytes.toString("utf8"), /[CD]:[\\/]/u);
});
