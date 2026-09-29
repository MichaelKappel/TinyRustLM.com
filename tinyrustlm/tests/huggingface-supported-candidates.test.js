"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const discovery = require("../tools/huggingface-supported-candidates.js");
const acquire = require("../tools/huggingface-candidate-acquire.js");
const { createSourceAcquisitionFixture } = require("./helpers/source-acquisition-fixture.js");

const revision = "a".repeat(40);
const weightSha = "b".repeat(64);
const chatTemplate = "{% for message in messages %}<|im_start|>{{ message.role }}\n{{ message.content }}<|im_end|>{% endfor %}<|im_start|>assistant\n";

test("candidate discovery, acquisition and rejection suites participate in the standard gate", () => {
  const { discoverStandardUnitTestFiles } = require("../tools/run-vnext-unit-test-gate.js");
  const files = discoverStandardUnitTestFiles();
  for (const name of ["huggingface-supported-candidates", "huggingface-candidate-acquire", "huggingface-weight-layout",
    "huggingface-candidate-storage", "huggingface-metadata", "source-candidate-exclusions"]) {
    assert.ok(files.includes(`tests/${name}.test.js`), name);
  }
});

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

// Returns the SmolLM2-360M metadata profile; conversion support is a separate gate.
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

// Replays official config/tokenizer metadata with synthetic source identities after its rejection.
// The real candidate remains excluded; model and tokenizer payload routes are absent.
function qwen25CoderRoster() {
  const captured = fs.readFileSync(path.resolve(__dirname,
    "../../artifacts/ecosystem-cleanup-20260912/qwen2.5-coder-0.5b-contingency-metadata-20260929.json"));
  assert.equal(crypto.createHash("sha256").update(captured).digest("hex"),
    "f70bac3ae6fab486f6624dacd1075ded3b33c5dd573900caa0ea6b4cc8230bd1");
  const metadata = JSON.parse(captured);
  const info = JSON.parse(metadata.responses.find(row => row.url.includes("/api/models/")).utf8);
  const sourceModelId = info.id;
  const sourceRevision = info.sha;
  info.id = "Fixture/Qwen2.5-Coder-0.5B-Instruct";
  info.sha = revision;
  info.siblings.find(row => row.rfilename === "model.safetensors").lfs.sha256 = weightSha;
  const search = "Qwen/Qwen2.5-Coder-0.5B-Instruct";
  const searchUrl = discovery.buildSearchUrl("https://huggingface.co", search, 1);
  const licenseUrl = "https://www.apache.org/licenses/LICENSE-2.0.txt";
  const routes = Object.fromEntries(metadata.responses.map(row => [
    row.url.replace(sourceModelId, info.id).replace(sourceRevision, info.sha), { text: row.utf8 }]));
  routes[discovery.buildRevisionInfoUrl("https://huggingface.co", info.id, info.sha)] = { json: info };
  routes[searchUrl] = { json: [info] };
  // This authority response is synthetic test data, not a publication-license receipt.
  routes[licenseUrl] = { text: "Apache License\nVersion 2.0, January 2004\n" };
  const requests = [];
  const fileUrl = name => discovery.buildResolveUrl("https://huggingface.co", info.id, info.sha, name);
  return { info, routes, requests, fileUrl, searchUrl, options: {
    profileId: "qwen2.5-0.5b-bpe", search, searchLimit: 1, candidateLimit: 1,
    fetchImpl: async url => { requests.push(String(url)); return fixtureFetch(routes)(url); }
  } };
}

test("Qwen2.5 Coder 0.5B profile admits synthetic identities with pinned config metadata without payload downloads", async () => {
  const fixture = qwen25CoderRoster();
  const report = await discovery.discoverCandidates(fixture.options);
  assert.equal(report.schema, "tinyrustlm.huggingface_supported_candidate_inventory.v4");
  assert.equal(report.candidateCount, 1);
  assert.deepEqual(report.rejections, []);
  const candidate = report.candidates[0];
  assert.equal(candidate.sourceTemplate, "qwen2.5-0.5b-bpe");
  assert.equal(candidate.modelId, "Fixture/Qwen2.5-Coder-0.5B-Instruct");
  assert.equal(candidate.revision, revision);
  assert.equal(candidate.configSha256, "b1e58593cd31852f7da5c2fc31ddf6135b9c066c0fd9177a4bbe95717083adff");
  assert.equal(candidate.sourceWeightByteCount, 988097824);
  assert.deepEqual(candidate.weightFiles.map(row => [row.filename, row.byteCount, row.sha256]),
    [["model.safetensors", 988097824, weightSha]]);
  assert.equal(candidate.weightIndex, null);
  assert.equal(candidate.chatTemplateFile, null);
  assert.equal(candidate.tokenizer.byteCount, 7031645);
  assert.equal(candidate.tokenizer.gitBlobId, "443909a61d429dff23010e5bddd28ff530edda00");
  assert.equal(candidate.tokenizerConfig.gitBlobId, "acee076f49bf3c0298e15de0909d1da7b392f0c3");
  assert.equal(candidate.generationConfig.gitBlobId, "c28f9c697cbc09f047434efec57556505af31111");
  const template = JSON.parse(fixture.routes[fixture.fileUrl("tokenizer_config.json")].text).chat_template;
  assert.equal(candidate.chatTemplateSha256, crypto.createHash("sha256").update(template).digest("hex"));
  assert.equal(fixture.requests.length, 6);
  assert.equal(fixture.requests.some(url => /\/tokenizer\.json$|\.safetensors$/.test(url)), false);
  assert.equal(Object.hasOwn(JSON.parse(fixture.routes[fixture.fileUrl("config.json")].text), "head_dim"), false);
  const oldProfile = await discovery.discoverCandidates({ ...fixture.options, profileId: "qwen2.5-1.5b-bpe" });
  assert.equal(oldProfile.candidateCount, 0);
  assert.equal(oldProfile.rejections[0].code, "full_weights_invalid");
});

test("Qwen2.5 0.5B profile refuses different shapes and weight bounds without widening the 1.5B profile", async () => {
  for (const field of ["hidden_size", "num_hidden_layers", "num_attention_heads", "num_key_value_heads",
    "intermediate_size", "vocab_size", "tie_word_embeddings"]) {
    const fixture = qwen25CoderRoster();
    const config = JSON.parse(fixture.routes[fixture.fileUrl("config.json")].text);
    config[field] = field === "tie_word_embeddings" ? false : config[field] + 1;
    fixture.routes[fixture.fileUrl("config.json")].text = JSON.stringify(config);
    const report = await discovery.discoverCandidates(fixture.options);
    assert.equal(report.candidateCount, 0, field);
    assert.equal(report.rejections[0].code, "shape_mismatch", field);
  }
  for (const bytes of [899999999, 1100000001]) {
    const fixture = qwen25CoderRoster();
    const weight = fixture.info.siblings.find(row => row.rfilename === "model.safetensors");
    weight.size = weight.lfs.size = bytes;
    const report = await discovery.discoverCandidates(fixture.options);
    assert.equal(report.candidateCount, 0);
    assert.equal(report.rejections[0].code, "full_weights_invalid");
    assert.equal(fixture.requests.length, 2);
  }
  assert.equal(discovery.profiles["qwen2.5-1.5b-bpe"].minimumWeightBytes, 2500000000);
  assert.equal(discovery.profiles["qwen2.5-1.5b-bpe"].config.hidden_size, 1536);
});

test("Qwen2.5 0.5B source profile preserves the terminal general-model exclusion before metadata reads", async () => {
  const fixture = qwen25CoderRoster();
  fixture.routes[fixture.searchUrl] = { json: [{ ...fixture.info,
    id: "Qwen/Qwen2.5-0.5B-Instruct", sha: "7ae557604adf67be50417f59c2c2f167def9a775" }] };
  const report = await discovery.discoverCandidates(fixture.options);
  assert.equal(report.candidateCount, 0);
  assert.match(report.rejections[0].code, /excluded|rejected/);
  assert.deepEqual(fixture.requests, [fixture.searchUrl]);
});

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

// Model-card-shaped metadata only; the fixture never serves model or tokenizer payloads.
function untiedExternalRoster() {
  const baseUrl = "https://huggingface.co";
  const licenseUrl = "https://www.apache.org/licenses/LICENSE-2.0.txt";
  const modelId = "Example/Qwen3-0.6B-Distilled-Untied";
  const config = { ...qwen3Config(), tie_word_embeddings: false };
  const model = { id: modelId, sha: revision, pipeline_tag: "text-generation",
    tags: ["safetensors", "text-generation", "license:apache-2.0"], config };
  const info = revisionInfo(modelId, config, 1_503_300_328);
  const generation = JSON.stringify({ eos_token_id: [151645, 151643], pad_token_id: 151643 });
  const identity = (filename, text) => ({ rfilename: filename, size: Buffer.byteLength(text),
    blobId: crypto.createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex") });
  info.siblings.push(identity("chat_template.jinja", chatTemplate), identity("generation_config.json", generation));
  const search = "Qwen3-0.6B";
  const fileUrl = name => `${baseUrl}/${modelId}/resolve/${revision}/${name}`;
  const routes = {
    [discovery.buildSearchUrl(baseUrl, search, 20)]: { json: [model] },
    [discovery.buildRevisionInfoUrl(baseUrl, modelId, revision)]: { json: info },
    [fileUrl("config.json")]: { text: JSON.stringify(config) },
    [fileUrl("tokenizer_config.json")]: { text: JSON.stringify({ tokenizer_class: "Qwen2Tokenizer" }) },
    [fileUrl("chat_template.jinja")]: { text: chatTemplate },
    [fileUrl("generation_config.json")]: { text: generation },
    [licenseUrl]: { text: "Apache License\nVersion 2.0, January 2004\n" }
  };
  return { config, info, routes, fileUrl, options: { baseUrl, licenseUrl, search, searchLimit: 20,
    candidateLimit: 1, profileId: "qwen3-0.6b-untied-bpe", fetchImpl: fixtureFetch(routes) } };
}

test("untied discovery pins a separate template and publisher generation settings without model downloads", async () => {
  const fixture = untiedExternalRoster();
  const report = await discovery.discoverCandidates(fixture.options);
  assert.equal(report.schema, "tinyrustlm.huggingface_supported_candidate_inventory.v4");
  assert.equal(report.candidateCount, 1);
  const candidate = report.candidates[0];
  assert.equal(candidate.chatTemplateFile.filename, "chat_template.jinja");
  assert.equal(candidate.chatTemplateFile.byteCount, Buffer.byteLength(chatTemplate));
  assert.equal(candidate.chatTemplateSha256, crypto.createHash("sha256").update(chatTemplate).digest("hex"));
  assert.equal(candidate.generationConfig.filename, "generation_config.json");
  assert.equal(candidate.generationConfig.gitBlobId,
    fixture.info.siblings.find(row => row.rfilename === "generation_config.json").blobId);
  assert.equal(candidate.sourceTemplate, "qwen3-0.6b-untied-bpe");
  assert.equal((await discovery.discoverCandidates({ ...fixture.options, profileId: "qwen3-0.6b-bpe" }))
    .rejections[0].code, "shape_mismatch");
});

test("untied discovery refuses ambiguous missing oversized and mismatched template evidence", async () => {
  const mutations = [
    f => { f.config.tie_word_embeddings = true; f.routes[f.fileUrl("config.json")].text = JSON.stringify(f.config); },
    f => { f.config.head_dim = 64; f.routes[f.fileUrl("config.json")].text = JSON.stringify(f.config); },
    f => { f.routes[f.fileUrl("tokenizer_config.json")].text = JSON.stringify({ chat_template: chatTemplate }); },
    f => { f.info.siblings = f.info.siblings.filter(row => row.rfilename !== "chat_template.jinja"); },
    f => { f.info.siblings.find(row => row.rfilename === "chat_template.jinja").size = 262145; },
    f => { f.routes[f.fileUrl("chat_template.jinja")].text = chatTemplate + "changed"; },
    f => { f.info.siblings.push({ rfilename: "chat_templates/default.jinja", size: 42, blobId: "f".repeat(40) }); },
    f => { f.info.siblings.find(row => row.rfilename === "generation_config.json").size = 262145; }
  ];
  for (const mutate of mutations) {
    const fixture = untiedExternalRoster();
    mutate(fixture);
    const report = await discovery.discoverCandidates(fixture.options);
    assert.equal(report.candidateCount, 0);
    assert.equal(report.rejections.length, 1);
  }
});

test("external metadata also binds LFS digests and rejects a correctly hashed non-ChatML template", async () => {
  for (const variant of ["valid", "wrong-digest", "not-chatml"]) {
    const fixture = untiedExternalRoster();
    const text = variant === "not-chatml" ? "A long plain template with no supported message role or ChatML delimiters." : chatTemplate;
    fixture.routes[fixture.fileUrl("chat_template.jinja")].text = text;
    const row = fixture.info.siblings.find(file => file.rfilename === "chat_template.jinja");
    row.lfs = { size: Buffer.byteLength(text), sha256: variant === "wrong-digest" ? "f".repeat(64) :
      crypto.createHash("sha256").update(text).digest("hex") };
    const report = await discovery.discoverCandidates(fixture.options);
    assert.equal(report.candidateCount, variant === "valid" ? 1 : 0);
    if (variant === "valid") assert.equal(report.candidates[0].chatTemplateFile.sha256, row.lfs.sha256);
  }
});

test("invalid explicit discovery limits fail before metadata requests", async () => {
  let requests = 0;
  const fetchImpl = async () => { requests++; return new Response("[]"); };
  for (const [field, maximum] of [["candidateLimit", 100], ["searchLimit", 500]]) {
    for (const value of [0, NaN, null, false, "", "1", -1, 1.5, Infinity, maximum + 1]) {
      await assert.rejects(discovery.discoverCandidates({ profileId: "qwen3-0.6b-bpe", fetchImpl, [field]: value }),
        field === "candidateLimit" ? /candidate limit is invalid/ : /search limit is invalid/,
        `${field}=${String(value)}`);
    }
  }
  assert.equal(requests, 0);
});

test("discovery applies omitted limits and admits both inclusive limit boundaries", async () => {
  for (const options of [{}, { candidateLimit: 1, searchLimit: 1 }, { candidateLimit: 100, searchLimit: 500 }]) {
    const urls = [];
    const report = await discovery.discoverCandidates({ profileId: "qwen3-0.6b-bpe", ...options,
      fetchImpl: async url => { urls.push(String(url)); return new Response("[]"); } });
    assert.equal(report.requestedCandidateLimit, options.candidateLimit ?? 40);
    assert.equal(report.searchLimit, options.searchLimit ?? 300);
    assert.equal(new URL(urls[0]).searchParams.get("limit"), String(options.searchLimit ?? 300));
    assert.equal(urls.length, 1);
  }
});

test("discovery CLI rejects invalid explicit limits before producing a report", () => {
  const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } = require("../tools/canonical-operation-scratch.js");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.resolve(__dirname, "../../artifacts/tests/candidate-selection-cli") });
  const output = path.join(owned.rootPath, "inventory.json");
  try {
    for (const [candidates, search, message] of [["0", "1", "candidate"], ["NaN", "1", "candidate"],
      ["", "1", "candidate"], ["1", "0", "search"], ["1", "NaN", "search"], ["1", "", "search"]]) {
      const result = spawnSync(process.execPath, [path.resolve(__dirname, "../tools/huggingface-supported-candidates.js"),
        output, "qwen3-0.6b-bpe", candidates, search], { encoding: "utf8", windowsHide: true, timeout: 10000,
        env: { ...process.env, NODE_V8_COVERAGE: "" } });
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`${message} limit is invalid`));
      assert.equal(fs.existsSync(output), false);
    }
  } finally { removeOwnedTemporaryDirectory(owned); }
});

test("discovery CLI rejects invalid output paths before any metadata request", () => {
  const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } = require("../tools/canonical-operation-scratch.js");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.resolve(__dirname, "../../artifacts/tests/candidate-selection-cli") });
  const preload = path.join(owned.rootPath, "no-network.cjs");
  const marker = path.join(owned.rootPath, "request-attempted");
  fs.writeFileSync(preload, `globalThis.fetch = async () => { require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'called'); return new Response('[]'); };\n`);
  const directory = path.join(owned.rootPath, "directory.json");
  fs.mkdirSync(directory);
  const original = path.join(owned.rootPath, "original.json");
  const linked = path.join(owned.rootPath, "linked.json");
  fs.writeFileSync(original, "preserved");
  fs.linkSync(original, linked);
  try {
    for (const output of ["relative.json", path.join(owned.rootPath, "inventory.txt"),
      path.resolve(__dirname, "outside-artifacts.json"), path.join(owned.rootPath, "NUL.json"), directory, linked]) {
      const result = spawnSync(process.execPath, ["--require", preload,
        path.resolve(__dirname, "../tools/huggingface-supported-candidates.js"),
        output, "qwen3-0.6b-bpe", "1", "1"], { encoding: "utf8", windowsHide: true,
        timeout: 10000, env: { ...process.env, NODE_V8_COVERAGE: "" } });
      assert.equal(result.status, 1, result.stderr);
      assert.equal(fs.existsSync(marker), false, `metadata requested before refusing ${output}`);
      assert.equal(result.stdout, "");
    }
    assert.equal(fs.readFileSync(original, "utf8"), "preserved");
  } finally { removeOwnedTemporaryDirectory(owned); }
});

test("discovery CLI reports the effective requested count and signals a shortfall", () => {
  const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } = require("../tools/canonical-operation-scratch.js");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.resolve(__dirname, "../../artifacts/tests/candidate-selection-cli") });
  const preload = path.join(owned.rootPath, "empty-search.cjs");
  fs.writeFileSync(preload, "globalThis.fetch = async () => new Response('[]');\n");
  try {
    for (const [args, expected] of [[[], 40], [["3", "20"], 3]]) {
      const output = path.join(owned.rootPath, `inventory-${expected}.json`);
      const result = spawnSync(process.execPath, ["--require", preload,
        path.resolve(__dirname, "../tools/huggingface-supported-candidates.js"),
        output, "qwen3-0.6b-bpe", ...args], { encoding: "utf8", windowsHide: true, timeout: 10000,
        env: { ...process.env, NODE_V8_COVERAGE: "" } });
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stdout, new RegExp(`0/${expected} ->`));
      assert.equal(JSON.parse(fs.readFileSync(output)).requestedCandidateLimit, expected);
    }
  } finally { removeOwnedTemporaryDirectory(owned); }
});

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

  assert.equal(report.schema, "tinyrustlm.huggingface_supported_candidate_inventory.v4");
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
  assert.equal(report.candidates[0].weightIndex, null);
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
  assert.equal(report.schema, "tinyrustlm.huggingface_supported_candidate_inventory.v4");
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

// Replace the direct fixture weights with an indexed, two-shard repository closure.
function indexedRoster() {
  const fixture = qwen25Roster();
  const info = fixture.routes[discovery.buildRevisionInfoUrl(
    fixture.options.baseUrl, fixture.model.id, revision)].json;
  info.siblings = info.siblings.filter((row) => row.rfilename !== "model.safetensors");
  const weightIndex = { rfilename: "model.safetensors.index.json", size: 400, blobId: "f".repeat(40) };
  info.siblings.push(weightIndex, ...[1, 2].map((number) => ({
    rfilename: `model-0000${number}-of-00002.safetensors`, size: 1_500_000_000,
    lfs: { size: 1_500_000_000, sha256: String(number).repeat(64) }
  })));
  return { ...fixture, info, weightIndex };
}

test("discovery retains the exact index identity without downloading its contents", async () => {
  for (const useLfs of [false, true]) {
    const fixture = indexedRoster();
    if (useLfs) fixture.weightIndex.lfs = { size: 400, sha256: "e".repeat(64) };
    const calls = [];
    const report = await discovery.discoverCandidates({ ...fixture.options, fetchImpl: async (url) => {
      calls.push(url); return fixture.options.fetchImpl(url);
    } });
    assert.equal(report.schema, "tinyrustlm.huggingface_supported_candidate_inventory.v4");
    assert.equal(report.candidates.length, 1);
    assert.deepEqual(report.rejections, []);
    const candidate = report.candidates[0];
    assert.deepEqual(candidate.weightIndex, { filename: "model.safetensors.index.json", byteCount: 400,
      sha256: useLfs ? "e".repeat(64) : null, gitBlobId: useLfs ? null : "f".repeat(40) });
    assert.equal(candidate.sourceWeightByteCount, 3_000_000_000);
    assert.deepEqual(candidate.weightFiles.map((row) => row.filename), [
      "model-00001-of-00002.safetensors", "model-00002-of-00002.safetensors"]);
    const canonical = candidate.weightFiles.map((row) => `${row.filename}:${row.byteCount}:${row.sha256}`).join("\n");
    assert.equal(candidate.weightIdentity, require("node:crypto").createHash("sha256").update(canonical).digest("hex"));
    assert.equal(calls.some((url) => url.includes("model.safetensors.index.json")), false);
    assert.equal(calls.length, 5);
  }
});

test("discovery rejects incomplete and ambiguous weight layouts before config or license retrieval", async () => {
  const cases = [
    ["missing index", (f) => { f.info.siblings = f.info.siblings.filter((r) => r !== f.weightIndex); }],
    ["oversized index", (f) => { f.weightIndex.size = 256 * 1024 + 1; }],
    ["empty index", (f) => { f.weightIndex.size = 0; }],
    ["missing index identity", (f) => { delete f.weightIndex.blobId; }],
    ["missing shard", (f) => { f.info.siblings.pop(); }],
    ["inconsistent shard total", (f) => { f.info.siblings.at(-1).rfilename = "model-00002-of-00003.safetensors"; }],
    ["duplicate index", (f) => { f.info.siblings.push({ ...f.weightIndex }); }],
    ["duplicate config", (f) => { f.info.siblings.push({ ...f.info.siblings[0] }); }],
    ["duplicate shard", (f) => { f.info.siblings.push({ ...f.info.siblings.at(-1) }); }],
    ["mixed direct and sharded", (f) => { f.info.siblings.push({ rfilename: "model.safetensors",
      size: 1_500_000_000, lfs: { size: 1_500_000_000, sha256: "d".repeat(64) } }); }],
    ["direct with index", (f) => { f.info.siblings = f.info.siblings.filter((r) => !r.rfilename.startsWith("model-"));
      f.info.siblings.push({ rfilename: "model.safetensors", size: 3_000_000_000,
        lfs: { size: 3_000_000_000, sha256: "d".repeat(64) } }); }],
    ["invalid sibling", (f) => { f.info.siblings.push(null); }]
  ];
  for (const [label, mutate] of cases) {
    const fixture = indexedRoster();
    mutate(fixture);
    let requests = 0;
    const report = await discovery.discoverCandidates({ ...fixture.options, fetchImpl: async (url) => {
      requests++; return fixture.options.fetchImpl(url);
    } });
    assert.equal(report.candidates.length, 0, label);
    assert.equal(report.rejections.length, 1, label);
    assert.equal(requests, 2, label);
  }
});
