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
  recordSourceModelScreen
} = require("../tools/source-model-screen-evidence.js");

const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

function tokenDigest(tokenIds) {
  const bytes = Buffer.alloc(tokenIds.length * 4);
  tokenIds.forEach((tokenId, index) => bytes.writeUInt32LE(tokenId, index * 4));
  return digest(bytes);
}

function writeFixture(root, overrides = {}, fixtureOptions = {}) {
  const sourceRoot = path.join(root, "source");
  fs.mkdirSync(sourceRoot, { recursive: true });
  const sourceGenerationConfig = fixtureOptions.sourceGenerationProfile
    ? {
        do_sample: true,
        eos_token_id: 2,
        temperature: 0.6,
        top_p: 0.95
      }
    : {};
  const sourceFiles = {
    "config.json": Buffer.from('{"model_type":"test"}\n'),
    "tokenizer.json": Buffer.from('{"version":"1.0"}\n'),
    "tokenizer_config.json": Buffer.from(fixtureOptions.missingChatTemplate
      ? '{}\n'
      : `${JSON.stringify({
          chat_template: "{{ messages }}",
          ...(fixtureOptions.largeTokenizerConfig ? { added_tokens_decoder: "x".repeat(300 * 1024) } : {})
        })}\n`),
    "LICENSE": Buffer.from("Synthetic test license\n"),
    "eval.txt": Buffer.from("case_count=2\n")
  };
  if (fixtureOptions.publisherGenerationOverride) {
    sourceFiles["README.md"] = Buffer.from(
      "Publisher generation contract: stop on token IDs 2 and 32000.\n"
    );
  }
  if (fixtureOptions.sourceGenerationProfile) {
    sourceFiles["generation_config.json"] = Buffer.from(
      `${JSON.stringify(sourceGenerationConfig)}\n`
    );
  }
  if (fixtureOptions.standaloneChatTemplate) {
    sourceFiles["chat_template.jinja"] = Buffer.from("{{ messages }}\n");
  }
  if (fixtureOptions.sentencePieceTokenizer) {
    sourceFiles["tokenizer.model"] = Buffer.from("sentencepiece-model-bytes");
  }
  const weightNames = fixtureOptions.sharded
    ? [
        "model.safetensors.index.json",
        "model-00001-of-00002.safetensors",
        "model-00002-of-00002.safetensors"
      ]
    : ["model.safetensors"];
  if (fixtureOptions.sharded) {
    sourceFiles["model-00001-of-00002.safetensors"] = Buffer.from("synthetic-model-shard-one");
    sourceFiles["model-00002-of-00002.safetensors"] = Buffer.from("synthetic-model-shard-two");
    sourceFiles["model.safetensors.index.json"] = Buffer.from(`${JSON.stringify({
      metadata: { total_size: 50 },
      weight_map: {
        "model.layer.0.weight": "model-00001-of-00002.safetensors",
        "model.layer.1.weight": "model-00002-of-00002.safetensors"
      }
    })}\n`);
  } else {
    sourceFiles["model.safetensors"] = Buffer.from("synthetic-model-weights");
  }
  for (const [name, bytes] of Object.entries(sourceFiles)) {
    fs.writeFileSync(path.join(sourceRoot, name), bytes);
  }
  const generationNames = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    ...(fixtureOptions.sourceGenerationProfile ? ["generation_config.json"] : []),
    ...(fixtureOptions.sentencePieceTokenizer ? ["tokenizer.model"] : []),
    ...(fixtureOptions.standaloneChatTemplate ? ["chat_template.jinja"] : [])
  ];
  const checkpointArtifacts = Object.fromEntries(
    [...weightNames, ...generationNames].map((name) => [name, {
      bytes: sourceFiles[name].length,
      sha256: digest(sourceFiles[name])
    }])
  );
  const sourceModelArtifactSha256 = fixtureOptions.sharded
    ? digest(canonicalJson(weightNames.map((name) => ({
        name,
        bytes: checkpointArtifacts[name].bytes,
        sha256: checkpointArtifacts[name].sha256
      }))))
    : checkpointArtifacts["model.safetensors"].sha256;
  const caseFixture = (index, rawOutput) => {
    const renderedPrompt = `<user>case ${index}</user>`;
    const promptTokenIds = [index + 1, 10];
    const outputTokenIds = [index + 20, 30];
    return {
      index,
      max_new_tokens: 2,
      generation_call_count: 1,
      output_transform: "none",
      seed: 42 + index,
      rendered_prompt: renderedPrompt,
      rendered_prompt_sha256: digest(Buffer.from(renderedPrompt, "utf8")),
      prompt_token_ids: promptTokenIds,
      prompt_token_sha256_le_u32: tokenDigest(promptTokenIds),
      output_token_ids: outputTokenIds,
      output_token_sha256_le_u32: tokenDigest(outputTokenIds),
      raw_output_text: rawOutput,
      first_step_top5: [
        { token_id: outputTokenIds[0], logit: 3.5, token_text: "synthetic" }
      ],
      elapsed_seconds: 0.5
    };
  };
  const generationProfile = fixtureOptions.sourceGenerationProfile ? "source" : "greedy";
  const generation = fixtureOptions.sourceGenerationProfile
    ? {
        do_sample: true,
        repetition_penalty: 1.0,
        pad_token_id: 2,
        eos_token_id: 2,
        temperature: 0.6,
        top_k: 50,
        top_p: 0.95
      }
    : {
        do_sample: false,
        repetition_penalty: 1.0,
        pad_token_id: 2,
        eos_token_id: 2,
        temperature: null,
        top_k: null,
        top_p: null
      };
  const screen = {
    schema: "tinyrustlm.reference_raw_quality.v4",
    source_model_id: "publisher/source-model",
    source_revision: "a".repeat(40),
    checkpoint_artifacts: checkpointArtifacts,
    adapter: null,
    eval_cases_sha256: digest(sourceFiles["eval.txt"]),
    system_prompt_mode: "included",
    system_prompt: "Private test system prompt",
    policy_examples: null,
    user_suffix: "",
    loader_contract: "local-files-no-remote-code-v1",
    torch_compile_mode: "disabled-eager",
    tokenizer_load_options: {
      local_files_only: true,
      trust_remote_code: false,
      fix_mistral_regex: Boolean(fixtureOptions.fixMistralRegex)
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
    generation_profile: generationProfile,
    generation_seed_base: 42,
    generation,
    source_generation_config: sourceGenerationConfig,
    publisher_generation_override: fixtureOptions.publisherGenerationOverride
      ? {
          authority_file: "README.md",
          authority_file_bytes: sourceFiles["README.md"].length,
          authority_file_sha256: digest(sourceFiles["README.md"]),
          eos_token_id: [2, 32000]
        }
      : null,
    reference_framework: "reference.generate",
    torch_version: "test",
    transformers_version: "test",
    dtype: "float32",
    device: "cpu",
    case_count: 2,
    cases: [
      caseFixture(0, "distinctive-private-raw-output-pass"),
      caseFixture(1, "distinctive-private-raw-output-fail")
    ],
    ...overrides
  };
  const screenPath = path.join(root, "screen.json");
  fs.writeFileSync(screenPath, `${JSON.stringify(screen, null, 2)}\n`);
  const assessment = {
    schema: "tinyrustlm.source_model_screen_assessment.v1",
    sourceModelId: screen.source_model_id,
    sourceRevision: screen.source_revision,
    sourceModelArtifactSha256,
    sourceScreenSha256: digest(fs.readFileSync(screenPath)),
    decision: "rejected",
    decisionAuthority: "engineering-source-screen-v1",
    architectureFamily: "test-dense",
    runtimeAdmission: "supported-test-only",
    licenseDisposition: "test-review-complete",
    blockerCode: "model_quality_rejected",
    criticalFailureCodes: ["constraint-violation"],
    caseDispositions: [
      { index: 0, status: "pass", failureCodes: [] },
      { index: 1, status: "fail", failureCodes: ["constraint-violation"] }
    ],
    officialReferences: ["https://example.test/model-card"]
  };
  const assessmentPath = path.join(root, "assessment.json");
  fs.writeFileSync(assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);
  return {
    assessmentPath,
    evalCasesPath: path.join(sourceRoot, "eval.txt"),
    licensePath: path.join(sourceRoot, "LICENSE"),
    screenPath,
    sourceRoot
  };
}

function options(root, fixture) {
  return {
    campaignId: "source-screen-test-20260715",
    evidenceRoot: path.join(root, "evidence"),
    startedAtUtc: "2026-07-15T10:00:00.000Z",
    completedAtUtc: "2026-07-15T10:01:00.000Z",
    ...fixture
  };
}

test("records an immutable rejected source screen without persisting private transcript text", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root);
  const first = recordSourceModelScreen(options(root, fixture));
  const second = recordSourceModelScreen(options(root, fixture));

  assert.equal(first.receipt.status, "rejected");
  assert.equal(first.receipt.publicSafeParameters.modelId, "publisher/source-model");
  assert.equal(first.receipt.publicSafeParameters.casesPassed, 1);
  assert.equal(first.receipt.publicSafeParameters.casesFailed, 1);
  assert.equal(first.receipt.inputHashes.sourceModel,
    digest(Buffer.from("synthetic-model-weights")));
  assert.equal(first.receipt.inputHashes.sourceTokenizerConfig,
    digest(fs.readFileSync(path.join(fixture.sourceRoot, "tokenizer_config.json"))));
  assert.equal(first.receipt.publicSafeParameters.sourceChatTemplateMode,
    "embedded-tokenizer-config");
  assert.equal(second.receipt.receiptId, first.receipt.receiptId);
  assert.deepEqual(first.receipt.toolNames, [
    "tinyrustlm-reference-raw-quality",
    "tinyrustlm-source-model-screen-evidence"
  ]);
  assert.deepEqual(first.receipt.toolVersions, ["6", "11"]);
  assert.equal(first.receipt.publicSafeParameters.loaderContract,
    "local-files-no-remote-code-v1");
  assert.equal(first.receipt.publicSafeParameters.systemPromptMode, "included");
  assert.equal(first.receipt.publicSafeParameters.torchCompileMode, "disabled-eager");
  assert.equal(first.receipt.publicSafeParameters.tokenizerRegexMode, "source-regex");
  assert.equal(first.receipt.publicSafeParameters.remoteCodeEnabled, false);
  assert.equal(first.receipt.toolBinaryHashes.length, 2);
  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  assert.equal(store.rebuild().receipts.length, 1);
  const persisted = JSON.stringify(first.receipt);
  assert.equal(persisted.includes("distinctive-private-raw-output"), false);
  assert.equal(persisted.includes("Private test system prompt"), false);
  assert.equal(persisted.includes(root), false);
});

test("accepts a bounded tokenizer config above the generic receipt JSON limit", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-large-tokenizer-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {}, { largeTokenizerConfig: true });

  assert.ok(fs.statSync(path.join(fixture.sourceRoot, "tokenizer_config.json")).size > 256 * 1024);
  const result = recordSourceModelScreen(options(root, fixture));

  assert.equal(result.receipt.status, "rejected");
  assert.equal(result.receipt.publicSafeParameters.sourceChatTemplateMode,
    "embedded-tokenizer-config");
});

test("binds a SentencePiece model as an execution input", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-sentencepiece-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {}, { sentencePieceTokenizer: true });

  const result = recordSourceModelScreen(options(root, fixture));

  assert.equal(result.receipt.publicSafeParameters.sourceExecutionArtifactCount, 4);
  const screen = JSON.parse(fs.readFileSync(fixture.screenPath, "utf8"));
  assert.equal(screen.checkpoint_artifacts["tokenizer.model"].sha256,
    digest(Buffer.from("sentencepiece-model-bytes")));
});

test("accepts one-call seeded sampling only when it matches the bound source profile", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-source-profile-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {}, { sourceGenerationProfile: true });

  const result = recordSourceModelScreen(options(root, fixture));

  assert.equal(result.receipt.status, "rejected");
  assert.equal(result.receipt.publicSafeParameters.generationProfile, "source");
  assert.equal(result.receipt.publicSafeParameters.samplingEnabled, true);
});

test("accepts and binds a valid explicit generation profile", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-explicit-profile-"));
  const changedRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "tinyrustlm-source-screen-explicit-profile-changed-"));
  context.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(changedRoot, { recursive: true, force: true });
  });
  const fixture = writeFixture(root, {
    generation_profile: "explicit",
    generation: {
      do_sample: true,
      repetition_penalty: 1.05,
      pad_token_id: 2,
      eos_token_id: 2,
      temperature: 0.05,
      top_k: 50,
      top_p: 1.0
    }
  });
  const changedFixture = writeFixture(changedRoot, {
    generation_profile: "explicit",
    generation: {
      do_sample: true,
      repetition_penalty: 1.05,
      pad_token_id: 2,
      eos_token_id: 2,
      temperature: 0.06,
      top_k: 50,
      top_p: 1.0
    }
  });

  const result = recordSourceModelScreen(options(root, fixture));
  const changedResult = recordSourceModelScreen(options(changedRoot, changedFixture));

  assert.equal(result.receipt.publicSafeParameters.generationProfile, "explicit");
  assert.equal(result.receipt.publicSafeParameters.samplingEnabled, true);
  assert.match(result.receipt.configurationHash, /^[a-f0-9]{64}$/u);
  assert.notEqual(result.receipt.configurationHash, changedResult.receipt.configurationHash);
});

test("binds an explicit publisher-authorized EOS override", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-eos-override-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    generation_profile: "explicit",
    generation: {
      do_sample: true,
      repetition_penalty: 1.05,
      pad_token_id: 2,
      eos_token_id: [2, 32000],
      temperature: 0.3,
      top_k: 40,
      top_p: 0.9
    }
  }, {
    publisherGenerationOverride: true,
    sourceGenerationProfile: true
  });

  const result = recordSourceModelScreen(options(root, fixture));
  const authority = fs.readFileSync(path.join(fixture.sourceRoot, "README.md"));

  assert.equal(result.receipt.publicSafeParameters.publisherGenerationOverride, true);
  assert.equal(result.receipt.inputHashes.publisherGenerationAuthority, digest(authority));
});

test("rejects drift in a publisher generation authority file", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-eos-authority-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    generation_profile: "explicit",
    generation: {
      do_sample: true,
      repetition_penalty: 1.05,
      pad_token_id: 2,
      eos_token_id: [2, 32000],
      temperature: 0.3,
      top_k: 40,
      top_p: 0.9
    }
  }, {
    publisherGenerationOverride: true,
    sourceGenerationProfile: true
  });
  fs.appendFileSync(path.join(fixture.sourceRoot, "README.md"), "changed\n");

  assert.throws(() => recordSourceModelScreen(options(root, fixture)),
    /publisher generation authority changed/u);
});

test("rejects type coercion in publisher generation authority metadata", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-eos-type-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    generation_profile: "explicit",
    generation: {
      do_sample: true,
      repetition_penalty: 1.05,
      pad_token_id: 2,
      eos_token_id: [2, 32000],
      temperature: 0.3,
      top_k: 40,
      top_p: 0.9
    }
  }, {
    publisherGenerationOverride: true,
    sourceGenerationProfile: true
  });
  const screen = JSON.parse(fs.readFileSync(fixture.screenPath, "utf8"));
  screen.publisher_generation_override.authority_file_bytes =
    String(screen.publisher_generation_override.authority_file_bytes);
  fs.writeFileSync(fixture.screenPath, `${JSON.stringify(screen, null, 2)}\n`);
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  assessment.sourceScreenSha256 = digest(fs.readFileSync(fixture.screenPath));
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);

  assert.throws(() => recordSourceModelScreen(options(root, fixture)),
    /publisher generation authority byte length is invalid/u);
});

test("rejects inconsistent explicit deterministic generation parameters", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-explicit-drift-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    generation_profile: "explicit",
    generation: {
      do_sample: false,
      repetition_penalty: 1.0,
      pad_token_id: 2,
      eos_token_id: 2,
      temperature: 0.6,
      top_k: null,
      top_p: null
    }
  });

  assert.throws(() => recordSourceModelScreen(options(root, fixture)),
    /explicit deterministic generation parameters are invalid/u);
});

test("rejects explicit token IDs that drift from the bound publisher config", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-explicit-token-drift-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    generation_profile: "explicit",
    generation: {
      do_sample: true,
      repetition_penalty: 1.0,
      pad_token_id: 2,
      eos_token_id: 3,
      temperature: 0.6,
      top_k: 50,
      top_p: 0.95
    }
  }, { sourceGenerationProfile: true });

  assert.throws(() => recordSourceModelScreen(options(root, fixture)),
    /explicit generation token IDs changed/u);
});

test("binds the explicit tokenizer regex correction in public-safe evidence", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-regex-fix-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {}, { fixMistralRegex: true });

  const result = recordSourceModelScreen(options(root, fixture));

  assert.equal(result.receipt.publicSafeParameters.tokenizerRegexMode, "fix-mistral-regex");
  assert.equal(result.receipt.publicSafeParameters.remoteCodeEnabled, false);
});

test("binds an explicitly omitted publisher-template system role", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-no-system-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    system_prompt_mode: "omitted-publisher-template",
    system_prompt: ""
  });

  const result = recordSourceModelScreen(options(root, fixture));

  assert.equal(result.receipt.publicSafeParameters.systemPromptMode,
    "omitted-publisher-template");
  assert.equal(result.receipt.inputHashes.systemPrompt, digest(Buffer.alloc(0)));
});

test("rejects a nonempty system prompt in omitted publisher-template mode", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-system-drift-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    system_prompt_mode: "omitted-publisher-template"
  });

  assert.throws(() => recordSourceModelScreen(options(root, fixture)),
    /omitted source screen system prompt must be empty/u);
  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  assert.equal(store.rebuild().receipts.length, 0);
});

test("rejects remote-code or unbound tokenizer loader behavior", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-loader-drift-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    tokenizer_load_options: {
      local_files_only: true,
      trust_remote_code: true,
      fix_mistral_regex: false
    }
  });

  assert.throws(() => recordSourceModelScreen(options(root, fixture)),
    /tokenizer load options changed/u);
  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  assert.equal(store.rebuild().receipts.length, 0);
});

test("rejects sampled parameter drift from the bound source profile", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-source-drift-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    generation: {
      do_sample: true,
      repetition_penalty: 1.0,
      pad_token_id: 2,
      eos_token_id: 2,
      temperature: 0.7,
      top_k: 50,
      top_p: 0.95
    }
  }, { sourceGenerationProfile: true });

  assert.throws(() => recordSourceModelScreen(options(root, fixture)),
    /source generation parameters changed/u);
});

test("rejects non-finite first-step diagnostics before writing evidence", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-nonfinite-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root);
  const screen = JSON.parse(fs.readFileSync(fixture.screenPath, "utf8"));
  screen.cases[0].first_step_top5[0].logit = null;
  fs.writeFileSync(fixture.screenPath, `${JSON.stringify(screen, null, 2)}\n`);
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  assessment.sourceScreenSha256 = digest(fs.readFileSync(fixture.screenPath));
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);

  assert.throws(() => recordSourceModelScreen(options(root, fixture)),
    /first-step logit is invalid/u);
  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  assert.equal(store.rebuild().receipts.length, 0);
});

test("preserves and supersedes more than one prior source-screen attempt", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-history-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root);

  const receipts = [recordSourceModelScreen(options(root, fixture)).receipt];
  for (const suffix of ["-second", "-third"]) {
    const screen = JSON.parse(fs.readFileSync(fixture.screenPath, "utf8"));
    screen.cases[0].raw_output_text += suffix;
    fs.writeFileSync(fixture.screenPath, `${JSON.stringify(screen, null, 2)}\n`);
    const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
    assessment.sourceScreenSha256 = digest(fs.readFileSync(fixture.screenPath));
    fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);
    receipts.push(recordSourceModelScreen(options(root, fixture)).receipt);
  }

  assert.deepEqual(receipts.map((receipt) => receipt.attempt), [1, 2, 3]);
  assert.deepEqual(receipts[2].supersedesReceiptIds, [receipts[1].receiptId]);
  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  assert.equal(store.rebuild().receipts.length, 3);
});

test("binds a standalone chat template and rejects template drift", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-template-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {}, { standaloneChatTemplate: true });

  fs.writeFileSync(path.join(fixture.sourceRoot, "chat_template.jinja"), "{{ changed }}\n");

  assert.throws(() => recordSourceModelScreen(options(root, fixture)),
    /chat_template\.jinja does not match/u);
  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  assert.equal(store.rebuild().receipts.length, 0);
});

test("rejects a source checkpoint with no bound default chat template", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-no-template-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {}, { missingChatTemplate: true });

  assert.throws(() => recordSourceModelScreen(options(root, fixture)),
    /no bound default chat template/u);
  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  assert.equal(store.rebuild().receipts.length, 0);
});

test("rejects a screen that allowed generation retries before writing evidence", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-retry-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, { generation_retries_allowed: true });

  assert.throws(() => recordSourceModelScreen(options(root, fixture)), /no-cheat compatible/u);
  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  assert.equal(store.rebuild().receipts.length, 0);
});

test("rejects assessment drift from the preserved raw screen", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-drift-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root);
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  assessment.sourceScreenSha256 = "f".repeat(64);
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);

  assert.throws(() => recordSourceModelScreen(options(root, fixture)), /transcript hash changed/u);
  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  assert.equal(store.rebuild().receipts.length, 0);
});

test("binds every file in an indexed sharded source checkpoint", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-sharded-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {}, { sharded: true });

  const result = recordSourceModelScreen(options(root, fixture));
  const weightNames = [
    "model.safetensors.index.json",
    "model-00001-of-00002.safetensors",
    "model-00002-of-00002.safetensors"
  ];
  const checkpointArtifacts = JSON.parse(fs.readFileSync(fixture.screenPath, "utf8"))
    .checkpoint_artifacts;
  const expectedIdentity = digest(canonicalJson(weightNames.map((name) => ({
    name,
    bytes: checkpointArtifacts[name].bytes,
    sha256: checkpointArtifacts[name].sha256
  }))));

  assert.equal(result.receipt.inputHashes.sourceModel, expectedIdentity);
  assert.equal(result.receipt.publicSafeParameters.sourceModelIdentityKind,
    "indexed-safetensors-set-v1");
  assert.equal(result.receipt.publicSafeParameters.sourceWeightArtifactCount, 3);
  assert.equal(result.receipt.publicSafeParameters.sourceWeightByteCount,
    weightNames.reduce((total, name) => total + checkpointArtifacts[name].bytes, 0));
});

test("rejects a missing indexed weight shard before writing evidence", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-screen-shard-missing-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {}, { sharded: true });
  fs.rmSync(path.join(fixture.sourceRoot, "model-00002-of-00002.safetensors"));

  assert.throws(() => recordSourceModelScreen(options(root, fixture)), /weight shard is missing/u);
  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  assert.equal(store.rebuild().receipts.length, 0);
});
