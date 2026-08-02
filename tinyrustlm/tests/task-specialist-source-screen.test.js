"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  CampaignEvidenceStore,
  canonicalJson
} = require("../tools/campaign-evidence-store.js");
const {
  buildArtifacts,
  categories,
  preferences,
  resourceOrder,
  taskContractId
} = require("../tools/task-specialist-case-generator.js");
const {
  aggregateVerdicts,
  evaluateCaseOutput,
  parseStrictJson,
  preregistrationSchema,
  runScreen,
  validatePreregistration
} = require("../tools/task-specialist-source-screen.js");
const {
  preregistrationSchema: preregistrationSchemaV2,
  receiptType: receiptTypeV2,
  toolVersion: toolVersionV2,
  validatePreregistration: validatePreregistrationV2,
  validateSourceParent: validateSourceParentV2
} = require("../tools/task-specialist-source-screen-v2.js");
const {
  preregistrationSchema: preregistrationSchemaV3,
  receiptType: receiptTypeV3,
  sourceWeightIdentity,
  toolVersion: toolVersionV3,
  validateCapture: validateCaptureV3,
  validatePreregistration: validatePreregistrationV3,
  validateSourceParent: validateSourceParentV3
} = require("../tools/task-specialist-source-screen-v3.js");

const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const hash = (character) => character.repeat(64);

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

function preregistrationFixture(overrides = {}) {
  return {
    schema: preregistrationSchema,
    experimentId: "planning-ledger-pilot-20260726",
    registeredAtUtc: "2026-07-26T12:00:00.000Z",
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
      modelId: "Qwen/Qwen2.5-0.5B-Instruct",
      sourceRevision: "7".repeat(40),
      sourceModelSha256: hash("a"),
      sourceExecutionInputsSha256: hash("b"),
      broadSourceScreenReceiptId: `sha256:${hash("c")}`,
      broadSourceScreenStatus: "rejected"
    },
    taskContract: {
      taskContractId,
      outputKeys: [
        "budgetUsd",
        "deadlineDate",
        "availableResources",
        "unavailableResources",
        "preference"
      ],
      resourceVocabulary: resourceOrder,
      preferenceVocabulary: preferences,
      claimBoundary: "source-screen-only-non-promotional-no-general-assistant-claim"
    },
    sealedInputs: {
      visibility: "private-prompts-and-expected-values-public-hashes-only",
      generatorVersion: "1",
      generatorSha256: hash("d"),
      captureToolSha256: hash("e"),
      evaluatorToolSha256: hash("f"),
      seedCommitmentSha256: hash("1"),
      privateCaseSetSha256: hash("2"),
      evalCasesSha256: hash("3"),
      publicManifestSha256: hash("4"),
      caseCount: 24,
      casesPerCategory: 3,
      categoryCount: 8
    },
    captureContract: {
      reportSchema: "tinyrustlm.reference_raw_quality.v4",
      generationProfile: "greedy",
      generationSeedBase: 202607260,
      generationCallsPerCase: 1,
      samplingAllowed: false,
      adapterAllowed: false,
      policyExamplesAllowed: false,
      userSuffixAllowed: false,
      responseRepairAllowed: false,
      retryAllowed: false,
      bestOfNAllowed: false,
      rawOutputPreserved: true,
      systemPromptSha256: hash("5")
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
      "Do not expose private prompts or expected values.",
      "Do not select a replacement seed after observing output.",
      "Do not retry a failed generation.",
      "Do not repair or wrap model output.",
      "Do not use best-of-N selection.",
      "Do not train on this sealed case family.",
      "Do not infer broad assistant quality from a source pass.",
      "Do not issue task-specific proof from a source pass."
    ],
    requiredNextGate: "If and only if this source screen passes, convert the exact source and rerun a larger independently sealed task suite against untouched native and browser .slm output before issuing task-specific proof.",
    ...overrides
  };
}

function preregistrationV2Fixture(overrides = {}) {
  const base = preregistrationFixture();
  return {
    ...base,
    schema: preregistrationSchemaV2,
    sourceModel: {
      ...base.sourceModel,
      broadSourceScreenRole: "broad-claim-boundary-only",
      sourceIdentityAuthority: "independent-task-capture-checkpoint-artifacts-v1"
    },
    ...overrides
  };
}

function preregistrationV3Fixture(overrides = {}) {
  const base = preregistrationV2Fixture();
  return {
    ...base,
    schema: preregistrationSchemaV3,
    sourceModel: {
      ...base.sourceModel,
      sourceWeightIdentityKind: "indexed-safetensors-set-v1",
      sourceWeightArtifactCount: 3,
      sourceWeightByteCount: 57
    },
    captureContract: {
      ...base.captureContract,
      chatTemplateOptions: {
        enable_thinking: false
      }
    },
    ...overrides
  };
}

test("secret-seeded case generation is deterministic and publishes hashes only", () => {
  const seed = Buffer.alloc(32, 0x3a);
  const first = buildArtifacts(seed, "planning-ledger-pilot-20260726");
  const second = buildArtifacts(seed, "planning-ledger-pilot-20260726");
  const changed = buildArtifacts(Buffer.alloc(32, 0x3b),
    "planning-ledger-pilot-20260726");

  assert.equal(first.privateCaseSetSha256, second.privateCaseSetSha256);
  assert.equal(first.evalCasesSha256, second.evalCasesSha256);
  assert.equal(first.publicManifestSha256, second.publicManifestSha256);
  assert.notEqual(first.privateCaseSetSha256, changed.privateCaseSetSha256);
  assert.equal(first.privateCaseSet.caseCount, 24);
  assert.equal(first.privateCaseSet.categories.length, categories.length);
  assert.equal(first.publicManifest.privatePromptBodiesPublished, false);
  assert.equal(first.publicManifest.privateExpectedValuesPublished, false);

  const publicText = first.publicBytes.toString("utf8");
  for (const candidate of first.privateCaseSet.cases) {
    assert.equal(publicText.includes(candidate.prompt), false);
    assert.equal(publicText.includes(JSON.stringify(candidate.expected)), false);
    assert.equal(digest(Buffer.from(candidate.prompt, "utf8")), candidate.promptSha256);
  }
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

test("preregistration grants no proof or product authority", () => {
  const inspected = validatePreregistration(preregistrationFixture());
  assert.equal(inspected.experimentId, "planning-ledger-pilot-20260726");
  assert.equal(inspected.acceptance.sourcePassGrantsTaskSpecificProof, false);
  assert.equal(inspected.acceptance.sourcePassGrantsBroadQuality, false);

  const invalid = preregistrationFixture({
    authority: {
      ...preregistrationFixture().authority,
      taskSpecificProofAuthority: true
    }
  });
  assert.throws(
    () => validatePreregistration(invalid),
    /cannot grant authority/
  );
});

test("v2 preregistration makes the broad parent context-only", () => {
  const inspected = validatePreregistrationV2(preregistrationV2Fixture());

  assert.equal(toolVersionV2, "2");
  assert.equal(receiptTypeV2, "tinyrustlm.model-source-task-screen-v2");
  assert.equal(inspected.sourceModel.broadSourceScreenRole,
    "broad-claim-boundary-only");
  assert.equal(inspected.sourceModel.sourceIdentityAuthority,
    "independent-task-capture-checkpoint-artifacts-v1");
  assert.equal(inspected.acceptance.sourcePassGrantsTaskSpecificProof, false);
  assert.equal(inspected.acceptance.sourcePassGrantsBroadQuality, false);

  const invalid = preregistrationV2Fixture({
    sourceModel: {
      ...preregistrationV2Fixture().sourceModel,
      broadSourceScreenRole: "source-identity-authority"
    }
  });
  assert.throws(
    () => validatePreregistrationV2(invalid),
    /broad source-screen role is invalid/
  );
});

test("v3 preregistration binds indexed weights and publisher chat-template options", () => {
  const inspected = validatePreregistrationV3(preregistrationV3Fixture());

  assert.equal(toolVersionV3, "3");
  assert.equal(receiptTypeV3, "tinyrustlm.model-source-task-screen-v3");
  assert.equal(inspected.sourceModel.sourceWeightIdentityKind,
    "indexed-safetensors-set-v1");
  assert.equal(inspected.sourceModel.sourceWeightArtifactCount, 3);
  assert.equal(inspected.sourceModel.sourceWeightByteCount, 57);
  assert.deepEqual(inspected.captureContract.chatTemplateOptions, {
    enable_thinking: false
  });

  for (const chatTemplateOptions of [
    { enable_thinking: true },
    { unsupported: false },
    { enable_thinking: false, thinking: false }
  ]) {
    const invalid = preregistrationV3Fixture({
      captureContract: {
        ...preregistrationV3Fixture().captureContract,
        chatTemplateOptions
      }
    });
    assert.throws(
      () => validatePreregistrationV3(invalid),
      /chat template options/
    );
  }
});

test("v3 canonicalizes indexed source weights and retains direct-weight support", () => {
  const index = { bytes: 11, sha256: hash("1") };
  const shardA = { bytes: 23, sha256: hash("2") };
  const shardB = { bytes: 23, sha256: hash("3") };
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
      sha256: hash("4")
    }
  }).sha256, expected);

  const direct = sourceWeightIdentity({
    "model.safetensors": { bytes: 17, sha256: hash("5") }
  });
  assert.equal(direct.identityKind, "direct-safetensors-sha256");
  assert.equal(direct.artifactCount, 1);
  assert.equal(direct.byteCount, 17);
  assert.equal(direct.sha256, hash("5"));
});

function baseReceipt(receiptType, overrides = {}) {
  return {
    receiptType,
    campaignId: "task-specialist-test-campaign",
    phase: "model-source-screen",
    attempt: 1,
    status: "rejected",
    createdAtUtc: "2026-07-26T12:00:00.000Z",
    completedAtUtc: "2026-07-26T12:00:01.000Z",
    inputReceiptIds: [],
    inputHashes: {
      sourceModel: hash("a"),
      sourceExecutionInputs: hash("b")
    },
    outputHashes: {
      assessment: hash("6"),
      sourceScreen: hash("7")
    },
    sourceRevision: "7".repeat(40),
    toolNames: ["synthetic-source-screen"],
    toolVersions: ["1"],
    toolBinaryHashes: [hash("8")],
    runtimeIdentifier: "win-x64",
    operatingSystem: "win32",
    architecture: "x64",
    hardwareEvidence: {},
    configurationHash: hash("9"),
    publicSafeParameters: {
      modelId: "Qwen/Qwen2.5-0.5B-Instruct",
      sourceModelId: "Qwen/Qwen2.5-0.5B-Instruct"
    },
    boundedDiagnostics: {},
    blockerCode: "model_quality_rejected",
    externalEvidenceReferences: [
      "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct"
    ],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "local",
    supersedesReceiptIds: [],
    attestationReference: null,
    ...overrides
  };
}

test("v2 independently binds task capture inputs while retaining a historical broad rejection", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-task-screen-v2-"));
  const store = new CampaignEvidenceStore(path.join(root, "evidence"));
  const sourceModelSha256 = hash("a");
  const sourceExecutionInputsSha256 = hash("b");
  const parent = store.putReceipt(baseReceipt("tinyrustlm.model-source-screen-v1", {
    inputHashes: {
      sourceModel: sourceModelSha256,
      sourceGenerationInputs: sourceExecutionInputsSha256
    },
    publicSafeParameters: {
      modelId: "Qwen/Qwen2.5-0.5B-Instruct",
      sourceModelId: "Qwen/Qwen2.5-0.5B-Instruct",
      decision: "rejected"
    }
  })).receipt;
  const preregistration = preregistrationV2Fixture({
    sourceModel: {
      modelId: "Qwen/Qwen2.5-0.5B-Instruct",
      sourceRevision: "7".repeat(40),
      sourceModelSha256,
      sourceExecutionInputsSha256,
      broadSourceScreenReceiptId: parent.receiptId,
      broadSourceScreenStatus: "rejected",
      broadSourceScreenRole: "broad-claim-boundary-only",
      sourceIdentityAuthority: "independent-task-capture-checkpoint-artifacts-v1"
    }
  });

  assert.equal(parent.inputHashes.sourceExecutionInputs, undefined);
  assert.equal(validateSourceParentV2(store, preregistration).receiptId,
    parent.receiptId);

  const changedSource = {
    ...preregistration,
    sourceModel: {
      ...preregistration.sourceModel,
      sourceModelSha256: hash("f")
    }
  };
  assert.throws(
    () => validateSourceParentV2(store, changedSource),
    /broad source-screen parent identity changed/
  );
});

test("v3 rejects broad-parent weight identity drift", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-task-screen-v3-parent-"));
  const store = new CampaignEvidenceStore(path.join(root, "evidence"));
  const parent = store.putReceipt(baseReceipt("tinyrustlm.model-source-screen-v1", {
    publicSafeParameters: {
      modelId: "Qwen/Qwen2.5-0.5B-Instruct",
      sourceModelId: "Qwen/Qwen2.5-0.5B-Instruct",
      decision: "rejected",
      sourceModelIdentityKind: "indexed-safetensors-set-v1",
      sourceWeightArtifactCount: 3,
      sourceWeightByteCount: 57
    }
  })).receipt;
  const preregistration = preregistrationV3Fixture({
    sourceModel: {
      ...preregistrationV3Fixture().sourceModel,
      broadSourceScreenReceiptId: parent.receiptId
    }
  });

  assert.equal(validateSourceParentV3(store, preregistration).receiptId,
    parent.receiptId);
  for (const changedField of [
    ["sourceWeightIdentityKind", "direct-safetensors-sha256"],
    ["sourceWeightArtifactCount", 4],
    ["sourceWeightByteCount", 58]
  ]) {
    const changed = {
      ...preregistration,
      sourceModel: {
        ...preregistration.sourceModel,
        [changedField[0]]: changedField[1]
      }
    };
    assert.throws(
      () => validateSourceParentV3(store, changed),
      /broad source-screen parent identity changed/
    );
  }
});

test("v3 capture binds canonical shard identity and exact chat-template options", () => {
  const checkpointArtifacts = {
    "config.json": { bytes: 2, sha256: digest("{}") },
    "tokenizer.json": { bytes: 2, sha256: digest("[]") },
    "tokenizer_config.json": { bytes: 20, sha256: digest('{"chat_template":"x"}') },
    "model.safetensors.index.json": { bytes: 11, sha256: hash("1") },
    "model-00002-of-00002.safetensors": { bytes: 23, sha256: hash("3") },
    "model-00001-of-00002.safetensors": { bytes: 23, sha256: hash("2") },
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
  const evalSha256 = hash("6");
  const preregistration = validatePreregistrationV3(preregistrationV3Fixture({
    sourceModel: {
      ...preregistrationV3Fixture().sourceModel,
      sourceModelSha256: weightIdentity.sha256,
      sourceExecutionInputsSha256: digest(canonicalJson(executionInputs)),
      sourceWeightArtifactCount: weightIdentity.artifactCount,
      sourceWeightByteCount: weightIdentity.byteCount
    },
    captureContract: {
      ...preregistrationV3Fixture().captureContract,
      systemPromptSha256: digest(systemPrompt)
    },
    sealedInputs: {
      ...preregistrationV3Fixture().sealedInputs,
      evalCasesSha256: evalSha256
    }
  }));
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

  assert.equal(validateCaptureV3(
    rawCapture,
    preregistration,
    privateSet,
    { sha256: evalSha256 }
  ).length, 1);
  assert.throws(
    () => validateCaptureV3(
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
    () => validateCaptureV3(
      {
        ...rawCapture,
        checkpoint_artifacts: {
          ...checkpointArtifacts,
          "model-00002-of-00002.safetensors": {
            ...checkpointArtifacts["model-00002-of-00002.safetensors"],
            sha256: hash("4")
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

test("source task screen binds a rejected broad parent and grants conversion spend only", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-task-screen-"));
  const evidenceRoot = path.join(root, "evidence");
  const privateRoot = path.join(root, "private");
  const experimentId = "planning-ledger-pilot-20260726";
  const artifacts = buildArtifacts(Buffer.alloc(32, 0x4a), experimentId);
  const generatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-case-generator.js");
  const captureToolPath = path.join(__dirname, "..", "tools",
    "reference-raw-quality.py");
  const evaluatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-source-screen.js");
  const checkpointArtifacts = {
    "config.json": { bytes: 2, sha256: digest("{}") },
    "tokenizer.json": { bytes: 2, sha256: digest("[]") },
    "tokenizer_config.json": { bytes: 20, sha256: digest('{"chat_template":"x"}') },
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
  const parent = store.putReceipt(baseReceipt("tinyrustlm.model-source-screen-v1", {
    inputHashes: {
      sourceModel: sourceModelSha256,
      sourceExecutionInputs: sourceExecutionInputsSha256
    }
  })).receipt;
  const preregistration = preregistrationFixture({
    experimentId,
    sourceModel: {
      modelId: "Qwen/Qwen2.5-0.5B-Instruct",
      sourceRevision: "7".repeat(40),
      sourceModelSha256,
      sourceExecutionInputsSha256,
      broadSourceScreenReceiptId: parent.receiptId,
      broadSourceScreenStatus: "rejected"
    },
    sealedInputs: {
      visibility: "private-prompts-and-expected-values-public-hashes-only",
      generatorVersion: "1",
      generatorSha256: digest(fs.readFileSync(generatorPath)),
      captureToolSha256: digest(fs.readFileSync(captureToolPath)),
      evaluatorToolSha256: digest(fs.readFileSync(evaluatorPath)),
      seedCommitmentSha256: artifacts.privateCaseSet.seedCommitmentSha256,
      privateCaseSetSha256: artifacts.privateCaseSetSha256,
      evalCasesSha256: artifacts.evalCasesSha256,
      publicManifestSha256: artifacts.publicManifestSha256,
      caseCount: 24,
      casesPerCategory: 3,
      categoryCount: 8
    },
    captureContract: {
      ...preregistrationFixture().captureContract,
      systemPromptSha256: digest(
        "You are TinyRustLM, a browser-local AI assistant. " +
        "You do not have personal experiences. Answer directly and helpfully."
      )
    }
  });
  const systemPrompt = "You are TinyRustLM, a browser-local AI assistant. " +
    "You do not have personal experiences. Answer directly and helpfully.";
  const rawCapture = {
    schema: "tinyrustlm.reference_raw_quality.v4",
    source_model_id: preregistration.sourceModel.modelId,
    source_revision: preregistration.sourceModel.sourceRevision,
    checkpoint_artifacts: checkpointArtifacts,
    adapter: null,
    eval_cases_sha256: artifacts.evalCasesSha256,
    system_prompt: systemPrompt,
    policy_examples: null,
    user_suffix: "",
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

  const preregistrationPath = path.join(root, "preregistration.json");
  const privateCaseSetPath = path.join(root, "case-set.private.json");
  const evalCasesPath = path.join(root, "eval-cases.private.txt");
  const publicManifestPath = path.join(root, "case-manifest.public.json");
  const rawCapturePath = path.join(root, "raw-capture.private.json");
  fs.writeFileSync(preregistrationPath, `${JSON.stringify(preregistration, null, 2)}\n`);
  fs.writeFileSync(privateCaseSetPath, artifacts.privateBytes);
  fs.writeFileSync(evalCasesPath, artifacts.evalBytes);
  fs.writeFileSync(publicManifestPath, artifacts.publicBytes);
  fs.writeFileSync(rawCapturePath, `${JSON.stringify(rawCapture, null, 2)}\n`);

  const result = runScreen({
    evidenceRoot,
    campaignId: "task-specialist-test-campaign",
    preregistrationPath,
    privateCaseSetPath,
    evalCasesPath,
    publicManifestPath,
    rawCapturePath,
    privateArtifactRoot: privateRoot,
    projectRevision: "a".repeat(40)
  });

  assert.equal(result.receipt.status, "pass");
  assert.equal(result.receipt.inputReceiptIds[0], parent.receiptId);
  assert.equal(result.receipt.publicSafeParameters.exactPassCount, 24);
  assert.equal(result.receipt.publicSafeParameters.conversionSpendAuthorized, true);
  assert.equal(result.receipt.publicSafeParameters.taskSpecificProofGranted, false);
  assert.equal(result.receipt.publicSafeParameters.broadQualityClaimSupported, false);
  assert.equal(result.receipt.publicSafeParameters.rawOutput, undefined);
  assert.equal(fs.existsSync(result.privateRawCapturePath), true);
  assert.equal(fs.existsSync(result.privateVerdictPath), true);
  assert.equal(fs.readFileSync(result.privateRawCapturePath, "utf8").includes(
    artifacts.privateCaseSet.cases[0].prompt), true);
});

test("committed Qwen3 1.7B v3 preregistration is sealed and public-safe", () => {
  const experimentRoot = path.join(__dirname, "..", "experiments", "task-specialists");
  const preregistrationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen3-17b-source-screen-preregistration.v3.json");
  const publicManifestPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen3-17b-case-manifest.v1.json");
  const evaluatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-source-screen-v3.js");
  const generatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-case-generator.js");
  const capturePath = path.join(__dirname, "..", "tools",
    "reference-raw-quality.py");
  const preregistration = JSON.parse(fs.readFileSync(preregistrationPath, "utf8"));
  const publicManifestBytes = fs.readFileSync(publicManifestPath);
  const publicManifest = JSON.parse(publicManifestBytes);
  const inspected = validatePreregistrationV3(preregistration);

  assert.equal(inspected.experimentId,
    "planning-constraint-ledger-qwen3-17b-pilot-20260726");
  assert.equal(inspected.sourceModel.modelId, "Qwen/Qwen3-1.7B");
  assert.equal(inspected.sourceModel.sourceWeightIdentityKind,
    "indexed-safetensors-set-v1");
  assert.equal(inspected.sourceModel.sourceWeightArtifactCount, 3);
  assert.equal(inspected.sourceModel.sourceWeightByteCount, 4063541197);
  assert.deepEqual(inspected.captureContract.chatTemplateOptions, {
    enable_thinking: false
  });
  assert.equal(digest(publicManifestBytes),
    preregistration.sealedInputs.publicManifestSha256);
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
  assert.equal(publicManifest.privatePromptBodiesPublished, false);
  assert.equal(publicManifest.privateExpectedValuesPublished, false);
  assert.equal(JSON.stringify(publicManifest).includes('"prompt":'), false);
  assert.equal(JSON.stringify(publicManifest).includes('"expected":'), false);
});

test("committed Qwen3 1.7B observation preserves only the bounded v3 rejection", () => {
  const experimentRoot = path.join(__dirname, "..", "experiments", "task-specialists");
  const preregistrationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen3-17b-source-screen-preregistration.v3.json");
  const publicManifestPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen3-17b-case-manifest.v1.json");
  const observationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen3-17b-source-screen-observation.v3.json");
  const preregistrationBytes = fs.readFileSync(preregistrationPath);
  const publicManifestBytes = fs.readFileSync(publicManifestPath);
  const preregistration = JSON.parse(preregistrationBytes);
  const observation = JSON.parse(fs.readFileSync(observationPath, "utf8"));

  assert.equal(digest(preregistrationBytes), observation.preregistrationSha256);
  assert.equal(digest(publicManifestBytes), observation.publicCaseManifestSha256);
  assert.equal(observation.sourceModel.sourceModelSha256,
    preregistration.sourceModel.sourceModelSha256);
  assert.equal(observation.sourceModel.sourceExecutionInputsSha256,
    preregistration.sourceModel.sourceExecutionInputsSha256);
  assert.equal(observation.sourceModel.sourceWeightIdentityKind,
    "indexed-safetensors-set-v1");
  assert.equal(observation.sourceModel.sourceWeightArtifactCount, 3);
  assert.equal(observation.sourceModel.sourceWeightByteCount, 4063541197);
  assert.deepEqual(observation.captureContract.chatTemplateOptions, {
    enable_thinking: false
  });
  assert.equal(observation.outcome.decision, "rejected");
  assert.equal(observation.outcome.caseCount, 24);
  assert.equal(observation.outcome.exactPassCount, 20);
  assert.equal(observation.outcome.failedCount, 4);
  assert.equal(observation.outcome.malformedOutputCount, 0);
  assert.equal(observation.outcome.criticalFailureCount, 3);
  assert.equal(observation.outcome.categoryPassCounts.length, 8);
  assert.equal(observation.outcome.categoryPassCounts.reduce(
    (total, category) => total + category.passed, 0), 20);
  assert.deepEqual(observation.outcome.failureCodes, ["semantic-value-mismatch"]);
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

test("committed 1.5B source-screen preregistration is sealed and public-safe", () => {
  const experimentRoot = path.join(__dirname, "..", "experiments", "task-specialists");
  const preregistrationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen25-15b-source-screen-preregistration.v2.json");
  const publicManifestPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen25-15b-case-manifest.v1.json");
  const evaluatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-source-screen-v2.js");
  const generatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-case-generator.js");
  const capturePath = path.join(__dirname, "..", "tools",
    "reference-raw-quality.py");
  const preregistration = JSON.parse(fs.readFileSync(preregistrationPath, "utf8"));
  const publicManifestBytes = fs.readFileSync(publicManifestPath);
  const publicManifest = JSON.parse(publicManifestBytes);
  const inspected = validatePreregistrationV2(preregistration);

  assert.equal(inspected.experimentId,
    "planning-constraint-ledger-qwen25-15b-pilot-20260726");
  assert.equal(inspected.sourceModel.broadSourceScreenRole,
    "broad-claim-boundary-only");
  assert.equal(inspected.sourceModel.sourceIdentityAuthority,
    "independent-task-capture-checkpoint-artifacts-v1");
  assert.equal(digest(publicManifestBytes),
    preregistration.sealedInputs.publicManifestSha256);
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
  assert.equal(publicManifest.privatePromptBodiesPublished, false);
  assert.equal(publicManifest.privateExpectedValuesPublished, false);
  assert.equal(JSON.stringify(publicManifest).includes('"prompt":'), false);
  assert.equal(JSON.stringify(publicManifest).includes('"expected":'), false);
});

test("committed LFM2 350M source-screen preregistration is sealed and public-safe", () => {
  const experimentRoot = path.join(__dirname, "..", "experiments", "task-specialists");
  const preregistrationPath = path.join(experimentRoot,
    "planning-constraint-ledger-lfm2-350m-source-screen-preregistration.v2.json");
  const publicManifestPath = path.join(experimentRoot,
    "planning-constraint-ledger-lfm2-350m-case-manifest.v1.json");
  const evaluatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-source-screen-v2.js");
  const generatorPath = path.join(__dirname, "..", "tools",
    "task-specialist-case-generator.js");
  const capturePath = path.join(__dirname, "..", "tools",
    "reference-raw-quality.py");
  const preregistration = JSON.parse(fs.readFileSync(preregistrationPath, "utf8"));
  const publicManifestBytes = fs.readFileSync(publicManifestPath);
  const publicManifest = JSON.parse(publicManifestBytes);
  const inspected = validatePreregistrationV2(preregistration);

  assert.equal(inspected.experimentId,
    "planning-constraint-ledger-lfm2-350m-pilot-20260726");
  assert.equal(inspected.sourceModel.modelId, "LiquidAI/LFM2-350M");
  assert.equal(inspected.sourceModel.broadSourceScreenRole,
    "broad-claim-boundary-only");
  assert.equal(inspected.sourceModel.sourceIdentityAuthority,
    "independent-task-capture-checkpoint-artifacts-v1");
  assert.equal(digest(publicManifestBytes),
    preregistration.sealedInputs.publicManifestSha256);
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
  assert.equal(publicManifest.privatePromptBodiesPublished, false);
  assert.equal(publicManifest.privateExpectedValuesPublished, false);
  assert.equal(JSON.stringify(publicManifest).includes('"prompt":'), false);
  assert.equal(JSON.stringify(publicManifest).includes('"expected":'), false);
});

test("committed LFM2 350M observation preserves only the bounded v2 rejection", () => {
  const experimentRoot = path.join(__dirname, "..", "experiments", "task-specialists");
  const preregistrationPath = path.join(experimentRoot,
    "planning-constraint-ledger-lfm2-350m-source-screen-preregistration.v2.json");
  const publicManifestPath = path.join(experimentRoot,
    "planning-constraint-ledger-lfm2-350m-case-manifest.v1.json");
  const observationPath = path.join(experimentRoot,
    "planning-constraint-ledger-lfm2-350m-source-screen-observation.v2.json");
  const preregistrationBytes = fs.readFileSync(preregistrationPath);
  const publicManifestBytes = fs.readFileSync(publicManifestPath);
  const preregistration = JSON.parse(preregistrationBytes);
  const observation = JSON.parse(fs.readFileSync(observationPath, "utf8"));

  assert.equal(digest(preregistrationBytes), observation.preregistrationSha256);
  assert.equal(digest(publicManifestBytes), observation.publicCaseManifestSha256);
  assert.equal(observation.sourceModel.sourceModelSha256,
    preregistration.sourceModel.sourceModelSha256);
  assert.equal(observation.sourceModel.sourceExecutionInputsSha256,
    preregistration.sourceModel.sourceExecutionInputsSha256);
  assert.equal(observation.sourceModel.broadSourceScreenRole,
    "broad-claim-boundary-only");
  assert.equal(observation.sourceModel.sourceIdentityAuthority,
    "independent-task-capture-checkpoint-artifacts-v1");
  assert.equal(observation.outcome.decision, "rejected");
  assert.equal(observation.outcome.caseCount, 24);
  assert.equal(observation.outcome.exactPassCount, 0);
  assert.equal(observation.outcome.malformedOutputCount, 24);
  assert.equal(observation.outcome.criticalFailureCount, 12);
  assert.equal(observation.outcome.categoryPassCounts.length, 8);
  assert.ok(observation.outcome.categoryPassCounts.every(
    (category) => category.passed === 0 && category.total === 3));
  assert.deepEqual(observation.outcome.failureCodes, ["invalid-json"]);
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

test("committed 1.5B observation preserves only the bounded v2 rejection", () => {
  const experimentRoot = path.join(__dirname, "..", "experiments", "task-specialists");
  const preregistrationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen25-15b-source-screen-preregistration.v2.json");
  const publicManifestPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen25-15b-case-manifest.v1.json");
  const observationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen25-15b-source-screen-observation.v2.json");
  const preregistrationBytes = fs.readFileSync(preregistrationPath);
  const publicManifestBytes = fs.readFileSync(publicManifestPath);
  const preregistration = JSON.parse(preregistrationBytes);
  const observation = JSON.parse(fs.readFileSync(observationPath, "utf8"));

  assert.equal(digest(preregistrationBytes), observation.preregistrationSha256);
  assert.equal(digest(publicManifestBytes), observation.publicCaseManifestSha256);
  assert.equal(observation.sourceModel.sourceModelSha256,
    preregistration.sourceModel.sourceModelSha256);
  assert.equal(observation.sourceModel.sourceExecutionInputsSha256,
    preregistration.sourceModel.sourceExecutionInputsSha256);
  assert.equal(observation.sourceModel.broadSourceScreenRole,
    "broad-claim-boundary-only");
  assert.equal(observation.sourceModel.sourceIdentityAuthority,
    "independent-task-capture-checkpoint-artifacts-v1");
  assert.equal(observation.outcome.decision, "rejected");
  assert.equal(observation.outcome.caseCount, 24);
  assert.equal(observation.outcome.exactPassCount, 0);
  assert.equal(observation.outcome.malformedOutputCount, 24);
  assert.equal(observation.outcome.criticalFailureCount, 12);
  assert.equal(observation.outcome.categoryPassCounts.length, 8);
  assert.ok(observation.outcome.categoryPassCounts.every(
    (category) => category.passed === 0 && category.total === 3));
  assert.deepEqual(observation.outcome.failureCodes, ["invalid-json"]);
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

test("committed source-screen observation preserves only the bounded rejection", () => {
  const experimentRoot = path.join(__dirname, "..", "experiments", "task-specialists");
  const preregistrationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen25-05b-source-screen-preregistration.v1.json");
  const publicManifestPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen25-05b-case-manifest.v1.json");
  const observationPath = path.join(experimentRoot,
    "planning-constraint-ledger-qwen25-05b-source-screen-observation.v1.json");
  const preregistrationBytes = fs.readFileSync(preregistrationPath);
  const publicManifestBytes = fs.readFileSync(publicManifestPath);
  const preregistration = JSON.parse(preregistrationBytes);
  const publicManifest = JSON.parse(publicManifestBytes);
  const observation = JSON.parse(fs.readFileSync(observationPath, "utf8"));

  assert.equal(digest(preregistrationBytes), observation.preregistrationSha256);
  assert.equal(digest(publicManifestBytes), observation.publicCaseManifestSha256);
  assert.equal(publicManifest.privateCaseSetSha256,
    preregistration.sealedInputs.privateCaseSetSha256);
  assert.equal(publicManifest.evalCasesSha256,
    preregistration.sealedInputs.evalCasesSha256);
  assert.equal(publicManifest.privatePromptBodiesPublished, false);
  assert.equal(publicManifest.privateExpectedValuesPublished, false);
  assert.equal(JSON.stringify(publicManifest).includes('"prompt":'), false);
  assert.equal(JSON.stringify(publicManifest).includes('"expected":'), false);
  assert.equal(observation.outcome.decision, "rejected");
  assert.equal(observation.outcome.caseCount, 24);
  assert.equal(observation.outcome.exactPassCount, 0);
  assert.equal(observation.outcome.malformedOutputCount, 24);
  assert.deepEqual(observation.outcome.failureCodes, ["invalid-json"]);
  assert.equal(observation.authority.conversionSpendAuthorized, false);
  assert.equal(observation.authority.trainingAuthorized, false);
  assert.equal(observation.authority.taskSpecificProofGranted, false);
  assert.equal(observation.authority.broadQualityClaimSupported, false);
  assert.equal(observation.authority.campaignCounterContribution, 0);
  assert.ok(Date.parse(observation.observedAtUtc) >
    Date.parse(preregistration.registeredAtUtc));
  assert.match(observation.receiptId, /^sha256:[a-f0-9]{64}$/u);
});
