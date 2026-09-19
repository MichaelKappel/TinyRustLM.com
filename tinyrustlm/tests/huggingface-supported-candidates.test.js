"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const discovery = require("../tools/huggingface-supported-candidates.js");
const acquire = require("../tools/huggingface-candidate-acquire.js");
const { createSourceAcquisitionFixture } = require("./helpers/source-acquisition-fixture.js");

const revision = "a".repeat(40);
const weightSha = "b".repeat(64);
const chatTemplate = "{% for message in messages %}<|im_start|>{{ message.role }}\n{{ message.content }}<|im_end|>{% endfor %}<|im_start|>assistant\n";

// Builds a bounded fetch double for primary-source-shaped HTTP responses.
function fixtureFetch(routes) {
  return async (url) => {
    const key = String(url);
    assert.ok(Object.hasOwn(routes, key), `unexpected URL: ${key}`);
    const value = routes[key];
    return new Response(value.text ?? JSON.stringify(value.json), { status: value.status || 200 });
  };
}

// Returns exact Qwen3-0.6B dimensions supported by the Rust converter.
function qwen3Config() {
  return {
    architectures: ["Qwen3ForCausalLM"],
    model_type: "qwen3",
    hidden_size: 1024,
    num_hidden_layers: 28,
    num_attention_heads: 16,
    num_key_value_heads: 8,
    head_dim: 128,
    intermediate_size: 3072,
    vocab_size: 151936,
    tie_word_embeddings: true
  };
}

// Returns exact SmolLM2-360M dimensions supported by the Rust converter.
function smollmConfig() {
  return {
    architectures: ["LlamaForCausalLM"],
    model_type: "llama",
    hidden_size: 960,
    num_hidden_layers: 32,
    num_attention_heads: 15,
    num_key_value_heads: 5,
    intermediate_size: 2560,
    vocab_size: 49152,
    tie_word_embeddings: true
  };
}

// Independently states the Qwen2.5 shape formerly exercised only by the retired producer.
function qwen25Config() {
  return { architectures: ["Qwen2ForCausalLM"], model_type: "qwen2", hidden_size: 1536,
    num_hidden_layers: 28, num_attention_heads: 12, num_key_value_heads: 2,
    intermediate_size: 8960, vocab_size: 151936, tie_word_embeddings: true };
}

// Builds one current-profile metadata roster without supplying or downloading any model bytes.
function qwen25Roster() {
  const baseUrl = "https://huggingface.co";
  const licenseUrl = "https://www.apache.org/licenses/LICENSE-2.0.txt";
  const search = "Qwen2.5-1.5B-Instruct";
  const modelId = "Example/Qwen2.5-1.5B-Instruct-FineTune";
  const model = { id: modelId, sha: revision, private: false, gated: false, disabled: false,
    pipeline_tag: "text-generation", tags: ["safetensors", "text-generation", "license:apache-2.0"],
    config: { model_type: "qwen2", architectures: ["Qwen2ForCausalLM"] } };
  const searchUrl = discovery.buildSearchUrl(baseUrl, search, 20);
  const routes = { [searchUrl]: { json: [model] },
    [licenseUrl]: { text: "Apache License\nVersion 2.0, January 2004\n" } };
  // Bind config and chat-template evidence for one exact revision in the fixture roster.
  function addRevision(id, config = qwen25Config(), flags = {}) {
    routes[discovery.buildRevisionInfoUrl(baseUrl, id, revision)] = {
      json: { ...revisionInfo(id, config, 3_087_467_144), ...flags } };
    routes[discovery.buildResolveUrl(baseUrl, id, revision, "config.json")] = { text: JSON.stringify(config) };
    routes[discovery.buildResolveUrl(baseUrl, id, revision, "tokenizer_config.json")] = {
      text: JSON.stringify({ chat_template: chatTemplate }) };
  }
  addRevision(modelId);
  return { model, routes, searchUrl, addRevision, options: { baseUrl, licenseUrl, search,
    searchLimit: 20, candidateLimit: 10, profileId: "qwen2.5-1.5b-bpe", fetchImpl: fixtureFetch(routes) } };
}

// Creates revision metadata with complete full weights and tokenizer evidence.
function revisionInfo(modelId, config, weightBytes) {
  return {
    id: modelId,
    sha: revision,
    pipeline_tag: "text-generation",
    cardData: { license: "apache-2.0" },
    siblings: [
      { rfilename: "config.json", size: 800, blobId: "c".repeat(40) },
      { rfilename: "tokenizer.json", size: 2_100_000, lfs: { size: 2_100_000, sha256: "d".repeat(64) } },
      { rfilename: "tokenizer_config.json", size: 2_000, blobId: "e".repeat(40) },
      { rfilename: "model.safetensors", size: weightBytes, lfs: { size: weightBytes, sha256: weightSha } }
    ],
    config
  };
}

test("discovers distinct immutable Qwen3 full-weight conversation candidates", async () => {
  const base = "https://huggingface.co";
  const licenseUrl = "https://www.apache.org/licenses/LICENSE-2.0.txt";
  const profileId = "qwen3-0.6b-bpe";
  const search = "Qwen3-0.6B";
  const firstId = "Example/Qwen3-0.6B-Dialog-SFT";
  const mirrorId = "Example/Qwen3-0.6B-Dialog-Mirror";
  const searchUrl = discovery.buildSearchUrl(base, search, 20);
  const model = {
    id: firstId,
    sha: revision,
    pipeline_tag: "text-generation",
    private: false,
    gated: false,
    disabled: false,
    downloads: 500,
    likes: 12,
    tags: ["safetensors", "text-generation", "license:apache-2.0"],
    config: { model_type: "qwen3", architectures: ["Qwen3ForCausalLM"] }
  };
  const routes = {
    [searchUrl]: { json: [model, { ...model, id: mirrorId }] },
    [licenseUrl]: { text: "Apache License\nVersion 2.0, January 2004\n" }
  };
  for (const modelId of [firstId, mirrorId]) {
    routes[discovery.buildRevisionInfoUrl(base, modelId, revision)] = {
      json: revisionInfo(modelId, qwen3Config(), 1_503_300_328)
    };
    routes[discovery.buildResolveUrl(base, modelId, revision, "config.json")] = {
      text: JSON.stringify(qwen3Config())
    };
    routes[discovery.buildResolveUrl(base, modelId, revision, "tokenizer_config.json")] = {
      text: JSON.stringify({ chat_template: chatTemplate })
    };
  }

  const report = await discovery.discoverCandidates({
    baseUrl: base,
    licenseUrl,
    fetchImpl: fixtureFetch(routes),
    profileId,
    search,
    searchLimit: 20,
    candidateLimit: 10
  });

  assert.equal(report.schema, "tinyrustlm.huggingface_supported_candidate_inventory.v2");
  assert.equal(report.profileId, profileId);
  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0].modelId, firstId);
  assert.equal(report.candidates[0].sourceTemplate, profileId);
  assert.equal(report.candidates[0].licenseEvidenceKind, "revision-metadata-plus-apache-authority-text");
  assert.equal(report.candidates[0].tokenizer.gitBlobId, null);
  assert.equal(report.candidates[0].tokenizerConfig.gitBlobId, "e".repeat(40));
  assert.equal(report.candidates[0].chatTemplateKind, "revision-chatml-template-v1");
  assert.equal(report.candidates[0].chatTemplateSha256.length, 64);
  assert.equal(report.candidates[0].weightFiles[0].sha256, weightSha);
  assert.equal(report.rejections.some((row) => row.code === "duplicate_weight_identity"), true);
});

test("accepts exact SmolLM2 shape and rejects non-conversation or prequantized packages", async () => {
  const base = "https://huggingface.co";
  const licenseUrl = "https://www.apache.org/licenses/LICENSE-2.0.txt";
  const profileId = "smollm2-360m-instruct-bpe";
  const search = "SmolLM2-360M-Instruct";
  const acceptedId = "Example/SmolLM2-360M-Instruct-Alpaca";
  const searchUrl = discovery.buildSearchUrl(base, search, 20);
  const accepted = {
    id: acceptedId,
    sha: revision,
    pipeline_tag: "text-generation",
    tags: ["safetensors", "text-generation", "license:apache-2.0"],
    config: { model_type: "llama", architectures: ["LlamaForCausalLM"] }
  };
  const routes = {
    [searchUrl]: {
      json: [
        accepted,
        { ...accepted, id: "Example/SmolLM2-360M-Embedding" },
        { ...accepted, id: "Example/SmolLM2-360M-Instruct-GGUF" }
      ]
    },
    [licenseUrl]: { text: "Apache License\nVersion 2.0, January 2004\n" },
    [discovery.buildRevisionInfoUrl(base, acceptedId, revision)]: {
      json: revisionInfo(acceptedId, smollmConfig(), 723_674_912)
    },
    [discovery.buildResolveUrl(base, acceptedId, revision, "config.json")]: {
      text: JSON.stringify(smollmConfig())
    },
    [discovery.buildResolveUrl(base, acceptedId, revision, "tokenizer_config.json")]: {
      text: JSON.stringify({ chat_template: chatTemplate })
    }
  };

  const report = await discovery.discoverCandidates({
    baseUrl: base,
    licenseUrl,
    fetchImpl: fixtureFetch(routes),
    profileId,
    search,
    searchLimit: 20,
    candidateLimit: 10
  });

  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0].modelId, acceptedId);
  assert.deepEqual(
    new Set(report.rejections.map((row) => row.code)),
    new Set(["not_conversation_model", "unsupported_packaging"])
  );
});

test("the sole discovery producer covers Qwen2.5 and emits the downloader's current inventory", async () => {
  const fixture = qwen25Roster();
  const mirror = "Example/Qwen2.5-1.5B-Instruct-Mirror";
  const wrongShape = "Example/Qwen2.5-1.5B-Instruct-WrongShape";
  const untied = "Example/Qwen2.5-1.5B-Instruct-Untied";
  fixture.routes[fixture.searchUrl].json.push(
    { ...fixture.model, id: mirror }, { ...fixture.model, id: wrongShape }, { ...fixture.model, id: untied },
    { ...fixture.model, id: "Example/Mutable", sha: "main" },
    { ...fixture.model, id: "Example/Qwen2.5-1.5B-Instruct-AWQ" },
    { ...fixture.model, id: "Example/Unlicensed-Instruct", tags: ["safetensors", "license:mit"] }
  );
  fixture.addRevision(mirror);
  fixture.addRevision(wrongShape, { ...qwen25Config(), hidden_size: 2048 });
  fixture.addRevision(untied, { ...qwen25Config(), tie_word_embeddings: false });
  const report = await discovery.discoverCandidates(fixture.options);
  assert.equal(report.schema, "tinyrustlm.huggingface_supported_candidate_inventory.v2");
  assert.equal(report.candidates.length, 1);
  const candidate = report.candidates[0];
  assert.equal(candidate.modelId, fixture.model.id);
  assert.equal(candidate.sourceTemplate, "qwen2.5-1.5b-bpe");
  assert.equal(candidate.chatTemplateKind, "revision-chatml-template-v1");
  assert.equal(candidate.licenseEvidenceKind, "revision-metadata-plus-apache-authority-text");
  assert.deepEqual(report.rejections.map((row) => row.code), ["duplicate_weight_identity", "shape_mismatch",
    "shape_mismatch", "immutable_revision_required", "unsupported_packaging", "license_evidence_not_supported"]);
  const owned = createSourceAcquisitionFixture();
  let requested = 0;
  // Reach only the first current inventory acquisition request; do not return any source bytes.
  const fetchImpl = async (url) => { requested++; assert.ok(url.endsWith("/config.json")); throw Error("fixture acquisition boundary"); };
  try {
    const directory = acquire.candidateDirectory(owned.rootPath, candidate);
    await assert.rejects(acquire.acquireInventory({ ...report, schema: "tinyrustlm.huggingface_candidate_inventory.v1" },
      owned.rootPath, { fetchImpl }), /inventory schema is invalid/);
    assert.equal(requested, 0);
    assert.equal(fs.existsSync(directory), false);
    await assert.rejects(acquire.acquireInventory(report, owned.rootPath, { fetchImpl }), /fixture acquisition boundary/);
    assert.equal(requested, 1);
    assert.deepEqual(fs.readdirSync(directory), []);
    assert.equal(fs.existsSync(path.join(directory, "source-acquisition.json")), false);
  } finally { owned.remove(); }
});

test("discovery excludes gated or unavailable search and pinned revision metadata", async () => {
  for (const flags of [{ gated: "auto" }, { gated: "manual" }, { gated: true }, { gated: null },
    { private: true }, { disabled: true }]) {
    for (const stage of ["search", "revision"]) {
      const fixture = qwen25Roster();
      const calls = [];
      if (stage === "search") Object.assign(fixture.model, flags);
      else fixture.addRevision(fixture.model.id, qwen25Config(), flags);
      const report = await discovery.discoverCandidates({ ...fixture.options, fetchImpl: async (url) => {
        calls.push(url); return fixture.options.fetchImpl(url);
      } });
      assert.deepEqual(report.rejections, [{ modelId: fixture.model.id, code: "source_not_public" }],
        `${stage}: ${JSON.stringify(flags)}`);
      assert.equal(report.candidates.length, 0);
      assert.equal(calls.length, stage === "search" ? 1 : 2);
    }
  }
});
