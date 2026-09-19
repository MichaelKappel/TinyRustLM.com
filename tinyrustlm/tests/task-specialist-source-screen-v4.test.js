"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  CampaignEvidenceStore,
  canonicalJson
} = require("../tools/campaign-evidence-store.js");
const {
  buildArtifacts,
  generatorVersion,
  validateExclusionSet
} = require("../tools/task-specialist-case-generator-v2.js");
const {
  aggregateVerdicts,
  evaluateCaseOutput,
  parseStrictJson,
  sourceWeightIdentity,
  validateCapture,
  validateSourceParent,
  preregistrationSchema,
  receiptType,
  runScreen,
  toolVersion,
  validatePreregistration
} = require("../tools/task-specialist-source-screen-v4.js");

const {
  createOwnedTemporaryDirectory,
  removeOwnedTemporaryDirectory
} = require("../tools/canonical-operation-scratch.js");

// Hash only synthetic fixture bytes or bounded committed evidence.
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const systemPrompt = "You are TinyRustLM, a browser-local AI assistant. " +
  "You do not have personal experiences. Answer directly and helpfully.";

// Read the committed exposure set without changing its closed history.
function exclusionBytes() {
  return fs.readFileSync(path.join(
    __dirname,
    "..",
    "experiments",
    "task-specialists",
    "planning-constraint-ledger-exclusion-set.v1.json"
  ));
}

// Write synthetic captures inside the test-owned canonical scratch directory.
function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

// Supply a synthetic broad rejection; it cannot grant product authority.
function baseReceipt(modelId, sourceRevision, sourceModelSha256, sourceBytes) {
  return {
    receiptType: "tinyrustlm.model-source-screen-v1",
    campaignId: "task-specialist-v4-test-campaign",
    phase: "model-source-screen",
    attempt: 1,
    status: "rejected",
    createdAtUtc: "2026-07-26T18:00:00.000Z",
    completedAtUtc: "2026-07-26T18:00:01.000Z",
    inputReceiptIds: [],
    inputHashes: {
      sourceModel: sourceModelSha256
    },
    outputHashes: {
      assessment: "6".repeat(64),
      sourceScreen: "7".repeat(64)
    },
    sourceRevision,
    toolNames: ["synthetic-source-screen"],
    toolVersions: ["1"],
    toolBinaryHashes: ["8".repeat(64)],
    runtimeIdentifier: "win-x64",
    operatingSystem: "win32",
    architecture: "x64",
    hardwareEvidence: {},
    configurationHash: "9".repeat(64),
    publicSafeParameters: {
      modelId,
      sourceModelId: modelId,
      decision: "rejected",
      sourceModelIdentityKind: "direct-safetensors-sha256",
      sourceWeightArtifactCount: 1,
      sourceWeightByteCount: sourceBytes
    },
    boundedDiagnostics: {},
    blockerCode: "model_quality_rejected",
    externalEvidenceReferences: ["https://example.test/model"],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "local",
    supersedesReceiptIds: [],
    attestationReference: null
  };
}

// Build a current synthetic registration, permitting exact fixture input bindings.
function preregistrationFixture(options = {}) {
  const experimentId = options.experimentId || "planning-ledger-v4-test-20260726";
  const excludedBytes = exclusionBytes();
  options = {
    experimentId,
    modelId: "Qwen/Qwen3-0.6B",
    sourceRevision: "c".repeat(40),
    sourceModelSha256: "1".repeat(64),
    sourceExecutionInputsSha256: "2".repeat(64),
    sourceWeightByteCount: 17,
    parentReceiptId: "sha256:" + "3".repeat(64),
    generatorSha256: "4".repeat(64),
    captureToolSha256: "5".repeat(64),
    evaluatorToolSha256: "6".repeat(64),
    exclusionSetSha256: digest(excludedBytes),
    excludedPromptCount: JSON.parse(excludedBytes).excludedPromptSha256.length,
    artifacts: options.artifacts ||
      buildArtifacts(Buffer.alloc(32, 0x42), experimentId, excludedBytes),
    ...options
  };
  return {
    schema: preregistrationSchema,
    experimentId: options.experimentId,
    registeredAtUtc: "2026-07-26T18:01:00.000Z",
    status: "preregistered-before-model-output",
    authority: {
      productAuthority: false,
      trainingAuthority: false,
      conversionAuthority: false,
      taskSpecificProofAuthority: false,
      broadQualityAuthority: false,
      releaseAuthority: false
    },
    sourceModel: {
      modelId: options.modelId,
      sourceRevision: options.sourceRevision,
      sourceModelSha256: options.sourceModelSha256,
      sourceExecutionInputsSha256: options.sourceExecutionInputsSha256,
      sourceWeightIdentityKind: "direct-safetensors-sha256",
      sourceWeightArtifactCount: 1,
      sourceWeightByteCount: options.sourceWeightByteCount,
      broadSourceScreenReceiptId: options.parentReceiptId,
      broadSourceScreenStatus: "rejected",
      broadSourceScreenRole: "broad-claim-boundary-only",
      sourceIdentityAuthority: "independent-task-capture-checkpoint-artifacts-v1"
    },
    taskContract: {
      taskContractId: "planning-constraint-ledger-json-v1",
      outputKeys: [
        "budgetUsd",
        "deadlineDate",
        "availableResources",
        "unavailableResources",
        "preference"
      ],
      resourceVocabulary: [
        "car",
        "internet",
        "kitchen",
        "laptop",
        "phone",
        "printer"
      ],
      preferenceVocabulary: ["cost", "privacy", "quality", "speed"],
      claimBoundary: "source-screen-only-non-promotional-no-general-assistant-claim"
    },
    sealedInputs: {
      visibility: "private-prompts-and-expected-values-public-hashes-only",
      generatorVersion,
      generatorSha256: options.generatorSha256,
      exclusionSetSha256: options.exclusionSetSha256,
      excludedPromptCount: options.excludedPromptCount,
      captureToolSha256: options.captureToolSha256,
      evaluatorToolSha256: options.evaluatorToolSha256,
      seedCommitmentSha256: options.artifacts.privateCaseSet.seedCommitmentSha256,
      privateCaseSetSha256: options.artifacts.privateCaseSetSha256,
      evalCasesSha256: options.artifacts.evalCasesSha256,
      publicManifestSha256: options.artifacts.publicManifestSha256,
      caseCount: 24,
      casesPerCategory: 3,
      categoryCount: 8
    },
    captureContract: {
      reportSchema: "tinyrustlm.reference_raw_quality.v4",
      generationProfile: "greedy",
      generationSeedBase: 202607264,
      generationCallsPerCase: 1,
      samplingAllowed: false,
      adapterAllowed: false,
      policyExamplesAllowed: false,
      userSuffixAllowed: false,
      responseRepairAllowed: false,
      retryAllowed: false,
      bestOfNAllowed: false,
      rawOutputPreserved: true,
      chatTemplateOptions: {
        enable_thinking: false
      },
      systemPromptSha256: digest(systemPrompt)
    },
    acceptance: {
      minimumExactPassCount: 21,
      minimumPerCategoryPassCount: 2,
      criticalCasesMustAllPass: true,
      malformedOutputMaximum: 0,
      deterministicReplayRequiredBeforePromotion: true,
      sourcePassAuthorizesConversionSpendOnly: true,
      sourcePassGrantsTaskSpecificProof: false,
      sourcePassGrantsBroadQuality: false
    },
    prohibitions: [
      "Do not publish private prompt bodies or expected values.",
      "Do not select another seed after observing model output.",
      "Do not retry a failed generation or choose a preferred attempt.",
      "Do not repair, wrap, trim into shape, or complete model output.",
      "Do not use best-of-N selection or an undeclared sampling profile.",
      "Do not train on this sealed case set or its template family.",
      "Do not infer broad assistant quality from a source-screen pass.",
      "Do not issue task-specific proof from a source-screen pass."
    ],
    requiredNextGate: "If and only if this source screen passes, convert the exact source and rerun a larger independently sealed task suite against untouched native and browser .slm output before issuing task-specific proof."
  };
}

// Confine fixture output to canonical artifacts and remove it even on test failure.
function ownedScratch(t) {
  const owned = createOwnedTemporaryDirectory({
    temporaryParent: path.resolve(__dirname, "../../artifacts/tests/task-screen-current-owner")
  });
  t.after(() => {
    removeOwnedTemporaryDirectory(owned);
    assert.equal(fs.existsSync(owned.rootPath), false);
  });
  return owned.rootPath;
}

// Vary one semantic field while retaining a valid planning-ledger schema.
function exactValue(overrides = {}) {
  return {
    budgetUsd: 125,
    deadlineDate: "2026-08-04",
    availableResources: ["car", "laptop"],
    unavailableResources: ["internet", "printer"],
    preference: "quality",
    ...overrides
  };
}


test("v2 generator deterministically excludes prior prompts and emits unique cases", () => {
  const excludedBytes = exclusionBytes();
  const exclusion = validateExclusionSet(JSON.parse(excludedBytes));
  const first = buildArtifacts(
    Buffer.alloc(32, 0x41),
    "planning-ledger-v2-test-20260726",
    excludedBytes
  );
  const second = buildArtifacts(
    Buffer.alloc(32, 0x41),
    "planning-ledger-v2-test-20260726",
    excludedBytes
  );
  const promptHashes = first.privateCaseSet.cases.map((item) => item.promptSha256);

  const changed = buildArtifacts(Buffer.alloc(32, 0x43),
    "planning-ledger-v2-test-20260726", excludedBytes);
  assert.notEqual(first.privateCaseSetSha256, changed.privateCaseSetSha256);
  assert.equal(first.evalCasesSha256, second.evalCasesSha256);
  for (const candidate of first.privateCaseSet.cases) {
    assert.equal(digest(candidate.prompt), candidate.promptSha256);
    assert.equal(first.publicBytes.includes(Buffer.from(candidate.prompt)), false);
    assert.equal(first.publicBytes.includes(Buffer.from(JSON.stringify(candidate.expected))), false);
  }
  assert.equal(first.privateCaseSetSha256, second.privateCaseSetSha256);
  assert.equal(first.publicManifestSha256, second.publicManifestSha256);
  assert.equal(first.exclusionSetSha256, digest(excludedBytes));
  assert.equal(first.excludedPromptCount, exclusion.excludedPromptSha256.length);
  assert.equal(new Set(promptHashes).size, 24);
  assert.equal(promptHashes.some(
    (value) => exclusion.excludedPromptSha256.includes(value)), false);
  assert.equal(first.privateCaseSet.cases.every(
    (item) => item.materializationAttemptCount >= 1), true);
  assert.equal(JSON.stringify(first.publicManifest).includes('"prompt":'), false);
  assert.equal(JSON.stringify(first.publicManifest).includes('"expected":'), false);
});

test("committed Qwen3 0.6B v4 preregistration is sealed and public-safe", () => {
  const experimentRoot = path.join(__dirname, "..", "experiments", "task-specialists");
  const preregistrationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen3-06b-source-screen-preregistration.v4.json");
  const publicManifestPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen3-06b-case-manifest.v2.json");
  const exclusionPath = path.join(experimentRoot,
    "planning-constraint-ledger-exclusion-set.v1.json");
  const evaluatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-source-screen-v4.js");
  const generatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-case-generator-v2.js");
  const capturePath = path.join(__dirname, "..", "tools",
    "reference-raw-quality.py");
  const preregistration = JSON.parse(fs.readFileSync(preregistrationPath, "utf8"));
  const publicManifestBytes = fs.readFileSync(publicManifestPath);
  const publicManifest = JSON.parse(publicManifestBytes);
  const exclusionBytes = fs.readFileSync(exclusionPath);
  const exclusion = validateExclusionSet(JSON.parse(exclusionBytes));
  const inspected = validatePreregistration(preregistration);

  assert.equal(inspected.experimentId,
    "planning-constraint-ledger-qwen3-06b-v2-pilot-20260726");
  assert.equal(inspected.sourceModel.modelId, "Qwen/Qwen3-0.6B");
  assert.equal(inspected.sourceModel.sourceWeightIdentityKind,
    "direct-safetensors-sha256");
  assert.equal(inspected.sourceModel.sourceWeightArtifactCount, 1);
  assert.equal(inspected.sourceModel.sourceWeightByteCount, 1503300328);
  assert.equal(inspected.sourceModel.broadSourceScreenStatus, "rejected");
  assert.deepEqual(inspected.captureContract.chatTemplateOptions, {
    enable_thinking: false
  });
  assert.equal(digest(publicManifestBytes),
    preregistration.sealedInputs.publicManifestSha256);
  assert.equal(digest(exclusionBytes),
    preregistration.sealedInputs.exclusionSetSha256);
  assert.equal(digest(fs.readFileSync(evaluatorPath)),
    preregistration.sealedInputs.evaluatorToolSha256);
  assert.equal(digest(fs.readFileSync(generatorPath)),
    preregistration.sealedInputs.generatorSha256);
  assert.equal(digest(fs.readFileSync(capturePath)),
    preregistration.sealedInputs.captureToolSha256);
  assert.equal(publicManifest.privateCaseSetSha256,
    preregistration.sealedInputs.privateCaseSetSha256);
  assert.equal(publicManifest.evalCasesSha256,
    preregistration.sealedInputs.evalCasesSha256);
  assert.equal(publicManifest.seedCommitmentSha256,
    preregistration.sealedInputs.seedCommitmentSha256);
  assert.equal(publicManifest.exclusionSetSha256,
    preregistration.sealedInputs.exclusionSetSha256);
  assert.equal(publicManifest.excludedPromptCount,
    exclusion.excludedPromptSha256.length);
  assert.equal(new Set(publicManifest.caseIdentities.map(
    (item) => item.promptSha256)).size, 24);
  assert.equal(publicManifest.caseIdentities.some(
    (item) => exclusion.excludedPromptSha256.includes(item.promptSha256)), false);
  assert.equal(publicManifest.privatePromptBodiesPublished, false);
  assert.equal(publicManifest.privateExpectedValuesPublished, false);
  assert.equal(JSON.stringify(publicManifest).includes('"prompt":'), false);
  assert.equal(JSON.stringify(publicManifest).includes('"expected":'), false);
});

test("committed Qwen3 0.6B v4 observation preserves only the bounded rejection", () => {
  const experimentRoot = path.join(__dirname, "..", "experiments", "task-specialists");
  const preregistrationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen3-06b-source-screen-preregistration.v4.json");
  const publicManifestPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen3-06b-case-manifest.v2.json");
  const observationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen3-06b-source-screen-observation.v4.json");
  const preregistrationBytes = fs.readFileSync(preregistrationPath);
  const publicManifestBytes = fs.readFileSync(publicManifestPath);
  const preregistration = JSON.parse(preregistrationBytes);
  const observation = JSON.parse(fs.readFileSync(observationPath, "utf8"));

  assert.equal(digest(preregistrationBytes), observation.preregistrationSha256);
  assert.equal(digest(publicManifestBytes), observation.publicCaseManifestSha256);
  assert.equal(observation.sealedInputs.exclusionSetSha256,
    preregistration.sealedInputs.exclusionSetSha256);
  assert.equal(observation.sealedInputs.excludedPromptCount,
    preregistration.sealedInputs.excludedPromptCount);
  assert.equal(observation.sourceModel.sourceModelSha256,
    preregistration.sourceModel.sourceModelSha256);
  assert.equal(observation.sourceModel.sourceExecutionInputsSha256,
    preregistration.sourceModel.sourceExecutionInputsSha256);
  assert.equal(observation.sourceModel.sourceWeightIdentityKind,
    "direct-safetensors-sha256");
  assert.equal(observation.sourceModel.sourceWeightArtifactCount, 1);
  assert.equal(observation.sourceModel.sourceWeightByteCount, 1503300328);
  assert.deepEqual(observation.captureContract.chatTemplateOptions, {
    enable_thinking: false
  });
  assert.equal(observation.outcome.decision, "rejected");
  assert.equal(observation.outcome.caseCount, 24);
  assert.equal(observation.outcome.exactPassCount, 11);
  assert.equal(observation.outcome.failedCount, 13);
  assert.equal(observation.outcome.malformedOutputCount, 12);
  assert.equal(observation.outcome.criticalFailureCount, 7);
  assert.equal(observation.outcome.categoryPassCounts.length, 8);
  assert.equal(observation.outcome.categoryPassCounts.reduce(
    (total, category) => total + category.passed, 0), 11);
  assert.deepEqual(observation.outcome.failureCodes, [
    "invalid-json",
    "schema-invalid",
    "semantic-value-mismatch"
  ]);
  assert.equal(observation.authority.conversionSpendAuthorized, false);
  assert.equal(observation.authority.trainingAuthorized, false);
  assert.equal(observation.authority.taskSpecificProofGranted, false);
  assert.equal(observation.authority.broadQualityClaimSupported, false);
  assert.equal(observation.authority.campaignCounterContribution, 0);
  assert.equal(observation.privacy.rawPromptBodiesPublished, false);
  assert.equal(observation.privacy.expectedValuesPublished, false);
  assert.equal(observation.privacy.rawOutputsPublished, false);
  assert.ok(Date.parse(observation.observedAtUtc) >
    Date.parse(preregistration.registeredAtUtc));
  assert.match(observation.receiptId, /^sha256:[a-f0-9]{64}$/u);
});

test("v4 source screen binds the exclusion set and grants conversion spend only", (t) => {
  const root = ownedScratch(t);
  const evidenceRoot = path.join(root, "evidence");
  const privateRoot = path.join(root, "private");
  const modelId = "Qwen/Qwen3-0.6B";
  const sourceRevision = "c".repeat(40);
  const experimentId = "planning-ledger-v4-test-20260726";
  const excludedBytes = exclusionBytes();
  const exclusion = validateExclusionSet(JSON.parse(excludedBytes));
  const artifacts = buildArtifacts(Buffer.alloc(32, 0x42), experimentId, excludedBytes);
  const generatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-case-generator-v2.js");
  const capturePath = path.join(__dirname, "..", "tools", "reference-raw-quality.py");
  const evaluatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-source-screen-v4.js");
  const checkpointArtifacts = {
    "config.json": { bytes: 2, sha256: digest("{}") },
    "tokenizer.json": { bytes: 2, sha256: digest("[]") },
    "tokenizer_config.json": {
      bytes: 21,
      sha256: digest('{"chat_template":"x"}')
    },
    "generation_config.json": { bytes: 2, sha256: digest("{}") },
    "model.safetensors": { bytes: 17, sha256: digest("synthetic weights") }
  };
  const executionInputs = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "generation_config.json"
  ].map((name) => ({ name, ...checkpointArtifacts[name] }));
  const sourceModelSha256 = checkpointArtifacts["model.safetensors"].sha256;
  const sourceExecutionInputsSha256 = digest(canonicalJson(executionInputs));
  const store = new CampaignEvidenceStore(evidenceRoot);
  const parent = store.putReceipt(baseReceipt(
    modelId,
    sourceRevision,
    sourceModelSha256,
    checkpointArtifacts["model.safetensors"].bytes
  )).receipt;
  const preregistration = preregistrationFixture({
    experimentId,
    modelId,
    sourceRevision,
    sourceModelSha256,
    sourceExecutionInputsSha256,
    sourceWeightByteCount: checkpointArtifacts["model.safetensors"].bytes,
    parentReceiptId: parent.receiptId,
    generatorSha256: digest(fs.readFileSync(generatorPath)),
    exclusionSetSha256: digest(excludedBytes),
    excludedPromptCount: exclusion.excludedPromptSha256.length,
    captureToolSha256: digest(fs.readFileSync(capturePath)),
    evaluatorToolSha256: digest(fs.readFileSync(evaluatorPath)),
    artifacts
  });
  const rawCapture = {
    schema: "tinyrustlm.reference_raw_quality.v4",
    source_model_id: modelId,
    source_revision: sourceRevision,
    checkpoint_artifacts: checkpointArtifacts,
    adapter: null,
    eval_cases_sha256: artifacts.evalCasesSha256,
    system_prompt: systemPrompt,
    policy_examples: null,
    user_suffix: "",
    chat_template_options: {
      enable_thinking: false
    },
    loader_contract: "local-files-no-remote-code-v1",
    torch_compile_mode: "disabled-eager",
    tokenizer_load_options: {
      local_files_only: true,
      trust_remote_code: false
    },
    model_load_options: {
      local_files_only: true,
      trust_remote_code: false,
      dtype: "float32"
    },
    generation_contract: "one-call-unmodified-v1",
    generation_retries_allowed: false,
    response_repairs_allowed: false,
    field_assembly_allowed: false,
    expected_answer_injection_allowed: false,
    generation_profile: "greedy",
    generation_seed_base: preregistration.captureContract.generationSeedBase,
    generation: {
      do_sample: false,
      repetition_penalty: 1,
      pad_token_id: 2,
      eos_token_id: 2,
      temperature: null,
      top_k: null,
      top_p: null
    },
    reference_framework: "synthetic-reference-generate",
    torch_version: "test",
    transformers_version: "test",
    dtype: "float32",
    device: "cpu",
    case_count: artifacts.privateCaseSet.caseCount,
    cases: artifacts.privateCaseSet.cases.map((candidate) => ({
      index: candidate.index,
      prompt: candidate.prompt,
      history: [],
      max_new_tokens: candidate.maxNewTokens,
      generation_call_count: 1,
      output_transform: "none",
      seed: preregistration.captureContract.generationSeedBase + candidate.index,
      raw_output_text: JSON.stringify(candidate.expected)
    }))
  };
  const paths = {
    preregistrationPath: path.join(root, "preregistration.json"),
    exclusionSetPath: path.join(root, "exclusion-set.json"),
    privateCaseSetPath: path.join(root, "case-set.private.json"),
    evalCasesPath: path.join(root, "eval-cases.private.txt"),
    publicManifestPath: path.join(root, "case-manifest.public.json"),
    rawCapturePath: path.join(root, "raw-capture.private.json")
  };
  writeJson(paths.preregistrationPath, preregistration);
  fs.writeFileSync(paths.exclusionSetPath, excludedBytes);
  fs.writeFileSync(paths.privateCaseSetPath, artifacts.privateBytes);
  fs.writeFileSync(paths.evalCasesPath, artifacts.evalBytes);
  fs.writeFileSync(paths.publicManifestPath, artifacts.publicBytes);
  writeJson(paths.rawCapturePath, rawCapture);

  const inspected = validatePreregistration(preregistration);
  const result = runScreen({
    evidenceRoot,
    campaignId: "task-specialist-v4-test-campaign",
    ...paths,
    privateArtifactRoot: privateRoot,
    projectRevision: "a".repeat(40)
  });

  assert.equal(toolVersion, "4");
  assert.equal(receiptType, "tinyrustlm.model-source-task-screen-v4");
  assert.equal(inspected.sealedInputs.exclusionSetSha256, digest(excludedBytes));
  assert.equal(result.receipt.status, "pass");
  assert.equal(result.receipt.inputHashes.exclusionSet, digest(excludedBytes));
  assert.equal(result.receipt.publicSafeParameters.exclusionSetBound, true);
  assert.equal(result.receipt.publicSafeParameters.excludedPromptCount,
    exclusion.excludedPromptSha256.length);
  assert.equal(result.receipt.publicSafeParameters.exactPassCount, 24);
  assert.equal(result.receipt.publicSafeParameters.conversionSpendAuthorized, true);
  assert.equal(result.receipt.publicSafeParameters.taskSpecificProofGranted, false);
  assert.equal(result.receipt.publicSafeParameters.broadQualityClaimSupported, false);
});

test("strict JSON parser rejects duplicate keys and non-JSON wrappers", () => {
  assert.deepEqual(parseStrictJson('{"a":1,"b":["x"]}'), { a: 1, b: ["x"] });
  assert.throws(
    () => parseStrictJson('{"a":1,"a":1}'),
    (error) => error.code === "duplicate-json-key"
  );
  assert.throws(
    () => parseStrictJson('```json\n{"a":1}\n```'),
    (error) => error.code === "invalid-json"
  );
  assert.throws(
    () => parseStrictJson('{"a":1} explanation'),
    (error) => error.code === "trailing-output"
  );
});

test("task output evaluation separates malformed output from semantic error", () => {
  const expected = exactValue();
  const pass = evaluateCaseOutput(JSON.stringify(expected), expected);
  assert.equal(pass.status, "pass");
  assert.equal(pass.exactMatch, true);
  assert.equal(pass.malformed, false);

  const semantic = evaluateCaseOutput(
    JSON.stringify(exactValue({ preference: "speed" })),
    expected
  );
  assert.equal(semantic.status, "fail");
  assert.equal(semantic.malformed, false);
  assert.deepEqual(semantic.failureCodes, ["semantic-value-mismatch"]);

  const extra = evaluateCaseOutput(
    '{"budgetUsd":125,"deadlineDate":"2026-08-04","availableResources":["car","laptop"],"unavailableResources":["internet","printer"],"preference":"quality","extra":true}',
    expected
  );
  assert.equal(extra.malformed, true);
  assert.deepEqual(extra.failureCodes, ["wrong-key-order"]);

  const wrongOrder = evaluateCaseOutput(
    '{"preference":"quality","budgetUsd":125,"deadlineDate":"2026-08-04","availableResources":["car","laptop"],"unavailableResources":["internet","printer"]}',
    expected
  );
  assert.equal(wrongOrder.malformed, true);
  assert.deepEqual(wrongOrder.failureCodes, ["wrong-key-order"]);

  const duplicate = evaluateCaseOutput(
    '{"budgetUsd":125,"budgetUsd":125,"deadlineDate":"2026-08-04","availableResources":["car","laptop"],"unavailableResources":["internet","printer"],"preference":"quality"}',
    expected
  );
  assert.equal(duplicate.malformed, true);
  assert.deepEqual(duplicate.failureCodes, ["duplicate-json-key"]);
});

test("aggregate stop rules reject critical failures independently of the overall floor", () => {
  const privateSet = {
    categories: [
      { id: "ordinary", critical: false, count: 2 },
      { id: "critical", critical: true, count: 2 }
    ],
    cases: [
      { caseId: "ordinary-1", category: "ordinary", critical: false, expected: exactValue() },
      { caseId: "ordinary-2", category: "ordinary", critical: false, expected: exactValue() },
      { caseId: "critical-1", category: "critical", critical: true, expected: exactValue() },
      { caseId: "critical-2", category: "critical", critical: true, expected: exactValue() }
    ]
  };
  const correct = JSON.stringify(exactValue());
  const wrong = JSON.stringify(exactValue({ preference: "speed" }));
  const result = aggregateVerdicts(
    privateSet,
    [
      { raw_output_text: correct },
      { raw_output_text: correct },
      { raw_output_text: correct },
      { raw_output_text: wrong }
    ],
    {
      minimumExactPassCount: 3,
      minimumPerCategoryPassCount: 1,
      criticalCasesMustAllPass: true,
      malformedOutputMaximum: 0
    }
  );
  assert.equal(result.exactPassCount, 3);
  assert.equal(result.decision, "rejected");
  assert.deepEqual(result.decisionReasons, ["critical-case-failed"]);
});

test("v4 canonicalizes indexed source weights and retains direct-weight support", () => {
  const index = { bytes: 11, sha256: "1".repeat(64) };
  const shardA = { bytes: 23, sha256: "2".repeat(64) };
  const shardB = { bytes: 23, sha256: "3".repeat(64) };
  const first = sourceWeightIdentity({
    "model-00002-of-00002.safetensors": shardB,
    "model.safetensors.index.json": index,
    "model-00001-of-00002.safetensors": shardA
  });
  const reordered = sourceWeightIdentity({
    "model-00001-of-00002.safetensors": shardA,
    "model-00002-of-00002.safetensors": shardB,
    "model.safetensors.index.json": index
  });
  const expected = digest(canonicalJson([
    { name: "model.safetensors.index.json", ...index },
    { name: "model-00001-of-00002.safetensors", ...shardA },
    { name: "model-00002-of-00002.safetensors", ...shardB }
  ]));

  assert.equal(first.identityKind, "indexed-safetensors-set-v1");
  assert.equal(first.artifactCount, 3);
  assert.equal(first.byteCount, 57);
  assert.equal(first.sha256, expected);
  assert.equal(reordered.sha256, expected);
  assert.notEqual(sourceWeightIdentity({
    "model.safetensors.index.json": index,
    "model-00001-of-00002.safetensors": shardA,
    "model-00002-of-00002.safetensors": {
      ...shardB,
      sha256: "4".repeat(64)
    }
  }).sha256, expected);

  const direct = sourceWeightIdentity({
    "model.safetensors": { bytes: 17, sha256: "5".repeat(64) }
  });
  assert.equal(direct.identityKind, "direct-safetensors-sha256");
  assert.equal(direct.artifactCount, 1);
  assert.equal(direct.byteCount, 17);
  assert.equal(direct.sha256, "5".repeat(64));
});

test("current registration rejects old schemas, authority and template drift", () => {
  const fixture = preregistrationFixture();
  const inspected = validatePreregistration(fixture);
  assert.equal(inspected.sourceModel.broadSourceScreenRole, "broad-claim-boundary-only");
  assert.equal(inspected.acceptance.sourcePassGrantsTaskSpecificProof, false);
  assert.equal(inspected.acceptance.sourcePassGrantsBroadQuality, false);
  for (const version of [1, 2, 3]) {
    const changed = structuredClone(fixture);
    changed.schema = "tinyrustlm.task-specialist-source-screen-preregistration.v" + version;
    assert.throws(() => validatePreregistration(changed), /schema is invalid/);
  }
  for (const key of Object.keys(fixture.authority)) {
    const changed = structuredClone(fixture);
    changed.authority[key] = true;
    assert.throws(() => validatePreregistration(changed), /cannot grant authority/);
  }
  const changed = structuredClone(fixture);
  changed.sourceModel.broadSourceScreenRole = "source-identity-authority";
  assert.throws(() => validatePreregistration(changed), /broad source-screen role is invalid/);
  for (const chatTemplateOptions of [
    { enable_thinking: true }, { unsupported: false },
    { enable_thinking: false, thinking: false }
  ]) {
    const invalid = structuredClone(fixture);
    invalid.captureContract.chatTemplateOptions = chatTemplateOptions;
    assert.throws(() => validatePreregistration(invalid), /chat template options/);
  }
});

test("current broad parent preserves rejection and rejects weight identity drift", (t) => {
  const fixture = preregistrationFixture();
  const source = fixture.sourceModel;
  const store = new CampaignEvidenceStore(path.join(ownedScratch(t), "evidence"));
  const parent = store.putReceipt(baseReceipt(source.modelId, source.sourceRevision,
    source.sourceModelSha256, source.sourceWeightByteCount)).receipt;
  source.broadSourceScreenReceiptId = parent.receiptId;
  assert.equal(validateSourceParent(store, fixture).receiptId, parent.receiptId);
  assert.equal(parent.status, "rejected");
  // The task capture binds execution inputs independently of the broad rejection.
  const independent = structuredClone(fixture);
  independent.sourceModel.sourceExecutionInputsSha256 = "8".repeat(64);
  assert.equal(validateSourceParent(store, independent).receiptId, parent.receiptId);
  for (const [field, value] of [
    ["sourceWeightIdentityKind", "indexed-safetensors-set-v1"],
    ["sourceWeightArtifactCount", 3], ["sourceWeightByteCount", 58],
    ["sourceModelSha256", "9".repeat(64)], ["sourceRevision", "d".repeat(40)],
    ["modelId", "Unrelated/Source"]
  ]) {
    const changed = structuredClone(fixture);
    changed.sourceModel[field] = value;
    assert.throws(() => validateSourceParent(store, changed), /parent identity changed/);
  }
});

test("v4 capture binds canonical shard identity and exact chat-template options", () => {
  const checkpointArtifacts = {
    "config.json": { bytes: 2, sha256: digest("{}") },
    "tokenizer.json": { bytes: 2, sha256: digest("[]") },
    "tokenizer_config.json": { bytes: 20, sha256: digest('{"chat_template":"x"}') },
    "model.safetensors.index.json": { bytes: 11, sha256: "1".repeat(64) },
    "model-00002-of-00002.safetensors": { bytes: 23, sha256: "3".repeat(64) },
    "model-00001-of-00002.safetensors": { bytes: 23, sha256: "2".repeat(64) },
    "generation_config.json": { bytes: 2, sha256: digest("{}") }
  };
  const weightIdentity = sourceWeightIdentity(checkpointArtifacts);
  const executionInputs = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "generation_config.json"
  ].map((name) => ({ name, ...checkpointArtifacts[name] }));
  const systemPrompt = "Bound system prompt";
  const evalSha256 = "6".repeat(64);
  const preregistration = preregistrationFixture();
  Object.assign(preregistration.sourceModel, {
    sourceModelSha256: weightIdentity.sha256,
    sourceExecutionInputsSha256: digest(canonicalJson(executionInputs)),
    sourceWeightIdentityKind: weightIdentity.identityKind,
    sourceWeightArtifactCount: weightIdentity.artifactCount,
    sourceWeightByteCount: weightIdentity.byteCount
  });
  preregistration.captureContract.systemPromptSha256 = digest(systemPrompt);
  preregistration.sealedInputs.evalCasesSha256 = evalSha256;
  validatePreregistration(preregistration);
  const privateSet = {
    cases: [{
      index: 0,
      prompt: "Return the ledger.",
      promptSha256: digest("Return the ledger."),
      maxNewTokens: 64
    }]
  };
  const rawCapture = {
    schema: "tinyrustlm.reference_raw_quality.v4",
    source_model_id: preregistration.sourceModel.modelId,
    source_revision: preregistration.sourceModel.sourceRevision,
    checkpoint_artifacts: checkpointArtifacts,
    adapter: null,
    eval_cases_sha256: evalSha256,
    system_prompt: systemPrompt,
    policy_examples: null,
    user_suffix: "",
    chat_template_options: {
      enable_thinking: false
    },
    loader_contract: "local-files-no-remote-code-v1",
    torch_compile_mode: "disabled-eager",
    tokenizer_load_options: {
      local_files_only: true,
      trust_remote_code: false
    },
    model_load_options: {
      local_files_only: true,
      trust_remote_code: false,
      dtype: "float32"
    },
    generation_contract: "one-call-unmodified-v1",
    generation_retries_allowed: false,
    response_repairs_allowed: false,
    field_assembly_allowed: false,
    expected_answer_injection_allowed: false,
    generation_profile: "greedy",
    generation_seed_base: preregistration.captureContract.generationSeedBase,
    generation: {
      do_sample: false,
      repetition_penalty: 1,
      temperature: null,
      top_k: null,
      top_p: null
    },
    dtype: "float32",
    device: "cpu",
    case_count: 1,
    cases: [{
      index: 0,
      prompt: privateSet.cases[0].prompt,
      history: [],
      max_new_tokens: 64,
      generation_call_count: 1,
      output_transform: "none",
      seed: preregistration.captureContract.generationSeedBase,
      raw_output_text: "{}"
    }]
  };

  assert.equal(validateCapture(
    rawCapture,
    preregistration,
    privateSet,
    { sha256: evalSha256 }
  ).length, 1);
  assert.throws(
    () => validateCapture(
      {
        ...rawCapture,
        chat_template_options: {}
      },
      preregistration,
      privateSet,
      { sha256: evalSha256 }
    ),
    /chat template options changed/
  );
  assert.throws(
    () => validateCapture(
      {
        ...rawCapture,
        checkpoint_artifacts: {
          ...checkpointArtifacts,
          "model-00002-of-00002.safetensors": {
            ...checkpointArtifacts["model-00002-of-00002.safetensors"],
            sha256: "4".repeat(64)
          }
        }
      },
      preregistration,
      privateSet,
      { sha256: evalSha256 }
    ),
    /checkpoint identity changed/
  );
});

// Frozen records are inspected as evidence, never dispatched to an obsolete evaluator.
for (const historical of [
  {
    "model": "qwen25-05b",
    "version": 1,
    "observationSha256": "4efacb513a452e539218488ffb0d1c724be843b17f2d1f9d5f8f7764aca608d4",
    "exact": 0,
    "malformed": 24,
    "criticalFailures": 12
  },
  {
    "model": "qwen25-15b",
    "version": 2,
    "observationSha256": "fdd2729f911bda75db193907e72fd444d4b7935dd5a8617f779d83caab55f2c7",
    "exact": 0,
    "malformed": 24,
    "criticalFailures": 12
  },
  {
    "model": "lfm2-350m",
    "version": 2,
    "observationSha256": "5e535478e6316ca381f63985c0a531777562e17c540e860d94723621aca22461",
    "exact": 0,
    "malformed": 24,
    "criticalFailures": 12
  },
  {
    "model": "qwen3-17b",
    "version": 3,
    "observationSha256": "a839911609a12e5c97f690b48a94d710330ed65f21908f0511f478f630083df0",
    "exact": 20,
    "malformed": 0,
    "criticalFailures": 3
  }
]) {
  test("closed " + historical.model + " rejection remains unchanged without an old evaluator", () => {
    const experimentRoot = path.join(__dirname, "../experiments/task-specialists");
    const prefix = "planning-constraint-ledger-" + historical.model;
    const registrationBytes = fs.readFileSync(path.join(experimentRoot,
      prefix + "-source-screen-preregistration.v" + historical.version + ".json"));
    const manifestBytes = fs.readFileSync(path.join(experimentRoot,
      prefix + "-case-manifest.v1.json"));
    const observationBytes = fs.readFileSync(path.join(experimentRoot,
      prefix + "-source-screen-observation.v" + historical.version + ".json"));
    const registration = JSON.parse(registrationBytes);
    const manifest = JSON.parse(manifestBytes);
    const observation = JSON.parse(observationBytes);
    assert.equal(digest(observationBytes), historical.observationSha256);
    assert.equal(digest(registrationBytes), observation.preregistrationSha256);
    assert.equal(digest(manifestBytes), observation.publicCaseManifestSha256);
    assert.equal(digest(manifestBytes), registration.sealedInputs.publicManifestSha256);
    for (const key of ["privateCaseSetSha256", "evalCasesSha256", "seedCommitmentSha256"]) {
      assert.equal(manifest[key], registration.sealedInputs[key]);
    }
    assert.equal(observation.sourceModel.modelId, registration.sourceModel.modelId);
    assert.equal(observation.sourceModel.sourceRevision, registration.sourceModel.sourceRevision);
    assert.equal(observation.sourceModel.sourceModelSha256, registration.sourceModel.sourceModelSha256);
    assert.equal(observation.outcome.decision, "rejected");
    assert.equal(observation.outcome.caseCount, 24);
    assert.equal(observation.outcome.exactPassCount, historical.exact);
    assert.equal(observation.outcome.failedCount, 24 - historical.exact);
    assert.equal(observation.outcome.malformedOutputCount, historical.malformed);
    assert.equal(observation.outcome.criticalFailureCount, historical.criticalFailures);
    for (const [key, value] of Object.entries(observation.authority)) {
      assert.equal(value, key === "campaignCounterContribution" ? 0 : false, key);
    }
    assert.equal(observation.privacy.rawPromptBodiesPublished, false);
    assert.equal(observation.privacy.expectedValuesPublished, false);
    assert.equal(observation.privacy.rawOutputsPublished, false);
    assert.equal(manifest.privatePromptBodiesPublished, false);
    assert.equal(manifest.privateExpectedValuesPublished, false);
    assert.equal(JSON.stringify(manifest).includes('"prompt":'), false);
    assert.equal(JSON.stringify(manifest).includes('"expected":'), false);
    assert.ok(Date.parse(observation.observedAtUtc) > Date.parse(registration.registeredAtUtc));
    assert.match(observation.receiptId, /^sha256:[a-f0-9]{64}$/u);
  });
}
