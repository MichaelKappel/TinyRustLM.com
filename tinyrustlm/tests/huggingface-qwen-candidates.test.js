"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const discovery = require("../tools/huggingface-qwen-candidates.js");

const revision = "a".repeat(40);
const weightSha = "b".repeat(64);

// Builds a bounded fetch double that returns primary-source-shaped Hugging Face data.
function fixtureFetch(routes) {
  return async (url) => {
    const key = String(url);
    assert.ok(Object.hasOwn(routes, key), `unexpected URL: ${key}`);
    const value = routes[key];
    return new Response(value.text ?? JSON.stringify(value.json), { status: value.status || 200 });
  };
}

// Produces exact Qwen2.5-1.5B dimensions accepted by the Rust source contract.
function qwenConfig() {
  return {
    architectures: ["Qwen2ForCausalLM"],
    model_type: "qwen2",
    hidden_size: 1536,
    num_hidden_layers: 28,
    num_attention_heads: 12,
    num_key_value_heads: 2,
    intermediate_size: 8960,
    vocab_size: 151936
  };
}

test("discovers one immutable unique licensed full-weight conversation candidate", async () => {
  const base = "https://huggingface.co";
  const searchUrl = discovery.buildSearchUrl(base, "qwen2.5 1.5b", 20);
  const modelId = "Example/Qwen2.5-1.5B-Instruct-FineTune";
  const mirrorId = "Example/Qwen2.5-1.5B-Instruct-Mirror";
  const model = {
    id: modelId,
    sha: revision,
    private: false,
    gated: false,
    disabled: false,
    downloads: 1234,
    likes: 20,
    tags: ["safetensors", "text-generation", "license:apache-2.0"],
    config: { model_type: "qwen2", architectures: ["Qwen2ForCausalLM"] }
  };
  const siblingInfo = {
    id: modelId,
    sha: revision,
    siblings: [
      { rfilename: "config.json", size: 700, blobId: "config-blob" },
      { rfilename: "tokenizer.json", size: 7_000_000, blobId: "tokenizer-blob" },
      { rfilename: "LICENSE", size: 11_343, blobId: "license-blob" },
      {
        rfilename: "model.safetensors",
        size: 3_087_467_144,
        lfs: { sha256: weightSha, size: 3_087_467_144 }
      }
    ]
  };
  const routes = {
    [searchUrl]: { json: [model, { ...model, id: mirrorId }] }
  };
  for (const id of [modelId, mirrorId]) {
    routes[discovery.buildRevisionInfoUrl(base, id, revision)] = {
      json: { ...siblingInfo, id }
    };
    routes[discovery.buildResolveUrl(base, id, revision, "config.json")] = {
      text: JSON.stringify(qwenConfig())
    };
    routes[discovery.buildResolveUrl(base, id, revision, "LICENSE")] = {
      text: "Apache License\nVersion 2.0, January 2004\n"
    };
  }

  const result = await discovery.discoverCandidates({
    baseUrl: base,
    fetchImpl: fixtureFetch(routes),
    search: "qwen2.5 1.5b",
    searchLimit: 20,
    candidateLimit: 10
  });

  assert.equal(result.schema, "tinyrustlm.huggingface_candidate_inventory.v1");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].modelId, modelId);
  assert.equal(result.candidates[0].revision, revision);
  assert.equal(result.candidates[0].licenseId, "apache-2.0");
  assert.equal(result.candidates[0].weightFiles[0].sha256, weightSha);
  assert.equal(result.rejections.some((row) => row.code === "duplicate_weight_identity"), true);
});

test("rejects mutable, quantized, unlicensed, and shape-incompatible candidates", async () => {
  const base = "https://huggingface.co";
  const searchUrl = discovery.buildSearchUrl(base, "qwen2.5 1.5b", 20);
  const wrongShapeId = "Example/Qwen2.5-1.5B-Instruct-WrongShape";
  const routes = {
    [searchUrl]: {
      json: [
        { id: "Example/Mutable", sha: "main", tags: ["safetensors", "license:apache-2.0"] },
        { id: "Example/Qwen-AWQ", sha: revision, tags: ["safetensors", "license:apache-2.0"] },
        {
          id: wrongShapeId,
          sha: revision,
          private: false,
          gated: false,
          tags: ["safetensors", "text-generation", "license:apache-2.0"],
          config: { model_type: "qwen2", architectures: ["Qwen2ForCausalLM"] }
        }
      ]
    },
    [discovery.buildRevisionInfoUrl(base, wrongShapeId, revision)]: {
      json: {
        id: wrongShapeId,
        sha: revision,
        siblings: [
          { rfilename: "config.json", size: 700 },
          { rfilename: "tokenizer.json", size: 7_000_000 },
          { rfilename: "LICENSE", size: 11_343 },
          {
            rfilename: "model.safetensors",
            size: 3_087_467_144,
            lfs: { sha256: weightSha, size: 3_087_467_144 }
          }
        ]
      }
    },
    [discovery.buildResolveUrl(base, wrongShapeId, revision, "config.json")]: {
      text: JSON.stringify({ ...qwenConfig(), hidden_size: 2048 })
    },
    [discovery.buildResolveUrl(base, wrongShapeId, revision, "LICENSE")]: {
      text: "Apache License\nVersion 2.0, January 2004\n"
    }
  };

  const result = await discovery.discoverCandidates({
    baseUrl: base,
    fetchImpl: fixtureFetch(routes),
    search: "qwen2.5 1.5b",
    searchLimit: 20,
    candidateLimit: 10
  });

  assert.equal(result.candidates.length, 0);
  assert.deepEqual(
    new Set(result.rejections.map((row) => row.code)),
    new Set(["immutable_revision_required", "unsupported_packaging", "shape_mismatch"])
  );
});
