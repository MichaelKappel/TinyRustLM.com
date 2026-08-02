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
  generatorVersion,
  languages,
  validateExclusionSet
} = require("../tools/code-diagnostic-case-generator-v1.js");
const {
  evaluateCaseOutput,
  preregistrationSchema,
  receiptType,
  requiredClaimBoundary,
  requiredNextGate,
  requiredProhibitions,
  requiredResultContract,
  runScreen,
  toolVersion,
  validatePreregistration
} = require("../tools/code-diagnostic-source-screen-v1.js");

const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const systemPrompt = "You are TinyRustLM, a browser-local AI assistant. " +
  "You do not have personal experiences. Answer directly and helpfully.";

function exclusionBytes() {
  return fs.readFileSync(path.join(
    __dirname,
    "..",
    "experiments",
    "task-specialists",
    "code-diagnostic-ledger-exclusion-set.v1.json"
  ));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function tokenDigest(tokenIds) {
  const bytes = Buffer.allocUnsafe(tokenIds.length * 4);
  tokenIds.forEach((tokenId, index) =>
    bytes.writeUInt32LE(tokenId, index * 4));
  return digest(bytes);
}

function sourceParent(modelId, revision, modelHash, modelBytes) {
  return {
    receiptType: "tinyrustlm.model-source-screen-v1",
    campaignId: "code-diagnostic-v1-test-campaign",
    phase: "model-source-screen",
    attempt: 1,
    status: "rejected",
    createdAtUtc: "2026-07-26T18:00:00.000Z",
    completedAtUtc: "2026-07-26T18:00:01.000Z",
    inputReceiptIds: [],
    inputHashes: {
      sourceModel: modelHash
    },
    outputHashes: {
      assessment: "6".repeat(64),
      sourceScreen: "7".repeat(64)
    },
    sourceRevision: revision,
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
      sourceWeightByteCount: modelBytes
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

function preregistrationFixture(options) {
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
      sourceExecutionInputsSha256:
        options.sourceExecutionInputsSha256,
      sourceWeightIdentityKind: "direct-safetensors-sha256",
      sourceWeightArtifactCount: 1,
      sourceWeightByteCount: options.sourceWeightByteCount,
      broadSourceScreenReceiptId: options.parentReceiptId,
      broadSourceScreenStatus: "rejected",
      broadSourceScreenRole: "broad-claim-boundary-only",
      sourceIdentityAuthority:
        "independent-task-capture-checkpoint-artifacts-v1"
    },
    taskContract: {
      taskContractId: "code-diagnostic-ledger-json-v1",
      outputKeys: [
        "language",
        "result",
        "issue",
        "repair",
        "complexity"
      ],
      languages: ["javascript", "python", "rust"],
      issueValues: [
        "missing-empty-guard",
        "none",
        "off-by-one",
        "wrong-comparison"
      ],
      repairValues: [
        "add-empty-guard",
        "exclusive-upper-bound",
        "none",
        "use-greater-or-equal"
      ],
      complexityValues: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
      resultContract: requiredResultContract,
      claimBoundary: requiredClaimBoundary
    },
    sealedInputs: {
      visibility:
        "private-prompts-and-expected-values-public-hashes-only",
      generatorVersion,
      generatorSha256: options.generatorSha256,
      exclusionSetSha256: options.exclusionSetSha256,
      excludedPromptCount: options.excludedPromptCount,
      captureToolSha256: options.captureToolSha256,
      evaluatorToolSha256: options.evaluatorToolSha256,
      seedCommitmentSha256:
        options.artifacts.privateCaseSet.seedCommitmentSha256,
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
      generationSeedBase: 202607267,
      generationCallsPerCase: 1,
      samplingAllowed: false,
      adapterAllowed: false,
      policyExamplesAllowed: false,
      userSuffixAllowed: false,
      responseRepairAllowed: false,
      retryAllowed: false,
      bestOfNAllowed: false,
      rawOutputPreserved: true,
      chatTemplateOptions: {},
      systemPromptSha256: digest(systemPrompt)
    },
    acceptance: {
      minimumExactPassCount: 21,
      minimumPerCategoryPassCount: 2,
      criticalCasesMustAllPass: true,
      malformedOutputMaximum: 0,
      deterministicReplayRequiredBeforePromotion: true,
      sourcePassAuthorizesSlmEvaluationOnly: true,
      sourcePassGrantsTaskSpecificProof: false,
      sourcePassGrantsBroadQuality: false
    },
    prohibitions: [...requiredProhibitions],
    requiredNextGate
  };
}

test("code diagnostic generator is deterministic, distinct, and public-safe", () => {
  const excludedBytes = exclusionBytes();
  const exclusion = validateExclusionSet(JSON.parse(excludedBytes));
  const first = buildArtifacts(
    Buffer.alloc(32, 0x53),
    "code-diagnostic-v1-generator-test",
    excludedBytes
  );
  const second = buildArtifacts(
    Buffer.alloc(32, 0x53),
    "code-diagnostic-v1-generator-test",
    excludedBytes
  );
  const promptHashes = first.privateCaseSet.cases.map(
    (candidate) => candidate.promptSha256);

  assert.equal(first.privateCaseSetSha256, second.privateCaseSetSha256);
  assert.equal(first.publicManifestSha256, second.publicManifestSha256);
  assert.equal(first.exclusionSetSha256, digest(excludedBytes));
  assert.equal(first.excludedPromptCount,
    exclusion.excludedPromptSha256.length);
  assert.equal(first.privateCaseSet.caseCount, 24);
  assert.equal(first.privateCaseSet.categories.length, 8);
  assert.equal(new Set(promptHashes).size, 24);
  assert.equal(promptHashes.some((hash) =>
    exclusion.excludedPromptSha256.includes(hash)), false);
  assert.equal(first.privateCaseSet.categories.every((category) => {
    const members = first.privateCaseSet.cases.filter(
      (candidate) => candidate.category === category.id);
    return canonicalJson(members.map((candidate) =>
      candidate.expected.language).sort()) ===
      canonicalJson([...languages].sort());
  }), true);
  assert.equal(JSON.stringify(first.publicManifest).includes('"prompt":'),
    false);
  assert.equal(JSON.stringify(first.publicManifest).includes('"expected":'),
    false);
});

test("code diagnostic evaluator distinguishes malformed and semantic failures", () => {
  const expected = {
    language: "javascript",
    result: "7",
    issue: "none",
    repair: "none",
    complexity: "O(1)"
  };
  const exact = evaluateCaseOutput(JSON.stringify(expected), expected);
  const duplicate = evaluateCaseOutput(
    "{\"language\":\"javascript\",\"language\":\"python\"," +
    "\"result\":\"7\",\"issue\":\"none\",\"repair\":\"none\"," +
    "\"complexity\":\"O(1)\"}",
    expected
  );
  const wrongOrder = evaluateCaseOutput(
    "{\"result\":\"7\",\"language\":\"javascript\",\"issue\":\"none\"," +
    "\"repair\":\"none\",\"complexity\":\"O(1)\"}",
    expected
  );
  const wrongType = evaluateCaseOutput(
    "{\"language\":\"javascript\",\"result\":7,\"issue\":\"none\"," +
    "\"repair\":\"none\",\"complexity\":\"O(1)\"}",
    expected
  );
  const semantic = evaluateCaseOutput(JSON.stringify({
    ...expected,
    result: "8"
  }), expected);

  assert.equal(exact.status, "pass");
  assert.deepEqual(duplicate.failureCodes, ["duplicate-json-key"]);
  assert.deepEqual(wrongOrder.failureCodes, ["wrong-key-order"]);
  assert.deepEqual(wrongType.failureCodes, ["schema-invalid"]);
  assert.equal(duplicate.malformed, true);
  assert.equal(wrongOrder.malformed, true);
  assert.equal(wrongType.malformed, true);
  assert.deepEqual(semantic.failureCodes, ["semantic-value-mismatch"]);
  assert.equal(semantic.malformed, false);
});

test("code diagnostic source screen binds all inputs and replays idempotently", (context) => {
  const root = fs.mkdtempSync(path.join(
    os.tmpdir(), "tinyrustlm-code-diagnostic-v1-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const evidenceRoot = path.join(root, "evidence");
  const privateRoot = path.join(root, "private");
  const modelId = "Qwen/Qwen2.5-Coder-1.5B-Instruct";
  const sourceRevision = "c".repeat(40);
  const experimentId = "code-diagnostic-v1-screen-test";
  const excludedBytes = exclusionBytes();
  const exclusion = validateExclusionSet(JSON.parse(excludedBytes));
  const artifacts = buildArtifacts(
    Buffer.alloc(32, 0x54), experimentId, excludedBytes);
  const generatorPath = path.join(
    __dirname, "..", "tools", "code-diagnostic-case-generator-v1.js");
  const capturePath = path.join(
    __dirname, "..", "tools", "reference-raw-quality.py");
  const evaluatorPath = path.join(
    __dirname, "..", "tools", "code-diagnostic-source-screen-v1.js");
  const checkpointArtifacts = {
    "config.json": { bytes: 2, sha256: digest("{}") },
    "tokenizer.json": { bytes: 2, sha256: digest("[]") },
    "tokenizer_config.json": {
      bytes: 21,
      sha256: digest("{\"chat_template\":\"x\"}")
    },
    "generation_config.json": { bytes: 2, sha256: digest("{}") },
    "model.safetensors": {
      bytes: 17,
      sha256: digest("synthetic weights")
    }
  };
  const executionInputs = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "generation_config.json"
  ].map((name) => ({ name, ...checkpointArtifacts[name] }));
  const sourceModelSha256 =
    checkpointArtifacts["model.safetensors"].sha256;
  const sourceExecutionInputsSha256 =
    digest(canonicalJson(executionInputs));
  const store = new CampaignEvidenceStore(evidenceRoot);
  const parent = store.putReceipt(sourceParent(
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
    sourceWeightByteCount:
      checkpointArtifacts["model.safetensors"].bytes,
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
    chat_template_options: {},
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
    generation_seed_base:
      preregistration.captureContract.generationSeedBase,
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
    cases: artifacts.privateCaseSet.cases.map((candidate) => {
      const promptTokenIds = [candidate.index + 1];
      const outputTokenIds = [candidate.index + 101];
      const renderedPrompt = `rendered:${candidate.prompt}`;
      return {
        index: candidate.index,
        prompt: candidate.prompt,
        history: [],
        max_new_tokens: candidate.maxNewTokens,
        required_answer_terms: [],
        forbidden_answer_terms: [],
        declarative_term_assessment: {
          required_terms_present: [],
          forbidden_terms_present: []
        },
        generation_call_count: 1,
        output_transform: "none",
        seed: preregistration.captureContract.generationSeedBase +
          candidate.index,
        rendered_prompt: renderedPrompt,
        rendered_prompt_sha256: digest(renderedPrompt),
        prompt_token_ids: promptTokenIds,
        prompt_token_sha256_le_u32: tokenDigest(promptTokenIds),
        output_token_ids: outputTokenIds,
        output_token_sha256_le_u32: tokenDigest(outputTokenIds),
        raw_output_text: JSON.stringify(candidate.expected),
        first_step_top5: [{
          token_id: outputTokenIds[0],
          logit: 1,
          token_text: "{"
        }],
        elapsed_seconds: 0.01
      };
    })
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
  const settings = {
    evidenceRoot,
    campaignId: "code-diagnostic-v1-test-campaign",
    ...paths,
    privateArtifactRoot: privateRoot,
    projectRevision: "a".repeat(40)
  };
  const first = runScreen(settings);
  const second = runScreen(settings);
  const receiptStore = new CampaignEvidenceStore(evidenceRoot);
  receiptStore.rebuild();
  const receipts = receiptStore.listReceipts((receipt) =>
    receipt.receiptType === receiptType);

  assert.equal(toolVersion, "1");
  assert.equal(receiptType,
    "tinyrustlm.model-source-code-diagnostic-screen-v1");
  assert.equal(inspected.sealedInputs.exclusionSetSha256,
    digest(excludedBytes));
  assert.equal(first.receipt.status, "pass");
  assert.equal(first.receipt.receiptId, second.receipt.receiptId);
  assert.equal(receipts.length, 1);
  assert.equal(first.receipt.inputHashes.exclusionSet,
    digest(excludedBytes));
  assert.equal(first.receipt.publicSafeParameters.exactPassCount, 24);
  assert.equal(first.receipt.publicSafeParameters.slmEvaluationAuthorized,
    true);
  assert.equal(first.receipt.publicSafeParameters.taskSpecificProofGranted,
    false);
  assert.equal(first.receipt.publicSafeParameters.broadQualityClaimSupported,
    false);
  assert.equal(first.receipt.publicSafeParameters.projectSourceRevision,
    "a".repeat(40));
});

test("code diagnostic category contract remains fixed", () => {
  assert.equal(categories.length, 8);
  assert.equal(categories.filter((category) => category.critical).length, 5);
  assert.deepEqual(categories.map((category) => category.id), [
    "trace-scalar",
    "trace-loop",
    "off-by-one",
    "wrong-operator",
    "empty-input",
    "comment-as-data",
    "string-as-data",
    "complexity"
  ]);
});
