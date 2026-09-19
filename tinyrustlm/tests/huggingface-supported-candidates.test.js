"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const discovery = require("../tools/huggingface-supported-candidates.js");

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
