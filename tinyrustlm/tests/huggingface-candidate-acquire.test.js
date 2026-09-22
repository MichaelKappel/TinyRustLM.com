"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } = require("../tools/canonical-operation-scratch.js");

const acquire = require("../tools/huggingface-candidate-acquire.js");
const { createSourceAcquisitionFixture } = require("./helpers/source-acquisition-fixture.js");

// Hashes fixture bytes using the source acquisition digest contract.
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

// Bind a tiny synthetic source so selection tests can distinguish validation from I/O.
function selectionCandidate(name = "One") {
  const template = "{% for message in messages %}<|im_start|>{{ message.role }} {{ message.content }}<|im_end|>{% endfor %}";
  const bodies = { "config.json": Buffer.from('{}'), "tokenizer.json": Buffer.from('{}'),
    "tokenizer_config.json": Buffer.from(JSON.stringify({ chat_template: template })),
    "model.safetensors": Buffer.from("selection fixture only"),
    LICENSE: Buffer.from("Apache License\nVersion 2.0\n") };
  const file = filename => ({ filename, byteCount: bodies[filename].length, sha256: sha256(bodies[filename]), gitBlobId: null });
  const weight = file("model.safetensors");
  return { bodies, candidate: { sourceTemplate: "qwen3-0.6b-bpe", modelId: `Example/Selection-${name}`,
    revision: "a".repeat(40), licenseId: "apache-2.0",
    licenseEvidenceKind: "revision-metadata-plus-apache-authority-text",
    licenseSourceUrl: "https://example.invalid/LICENSE", licenseSha256: sha256(bodies.LICENSE),
    configSha256: sha256(bodies["config.json"]), tokenizer: file("tokenizer.json"),
    tokenizerConfig: file("tokenizer_config.json"), chatTemplateKind: "revision-chatml-template-v1",
    chatTemplateSha256: sha256(Buffer.from(template)), sourceWeightByteCount: weight.byteCount,
    weightIdentity: sha256(Buffer.from(`${weight.filename}:${weight.byteCount}:${weight.sha256}`)), weightIndex: null, weightFiles: [weight] } };
}

// Keep shard bodies synthetic while binding the exact index needed by the real screen consumer.
function shardedCandidate() {
  const fixture = selectionCandidate("Sharded");
  delete fixture.bodies["model.safetensors"];
  const names = ["model-00001-of-00002.safetensors", "model-00002-of-00002.safetensors"];
  for (const [index, name] of names.entries()) fixture.bodies[name] = Buffer.from(`synthetic shard ${index}`);
  fixture.candidate.weightFiles = names.map(filename => ({ filename, byteCount: fixture.bodies[filename].length,
    sha256: sha256(fixture.bodies[filename]), gitBlobId: null }));
  fixture.candidate.sourceWeightByteCount = fixture.candidate.weightFiles.reduce((sum, file) => sum + file.byteCount, 0);
  fixture.candidate.weightIdentity = sha256(Buffer.from(fixture.candidate.weightFiles
    .map(file => `${file.filename}:${file.byteCount}:${file.sha256}`).join("\n")));
  setShardIndex(fixture, JSON.stringify({ metadata: { total_size: 2 },
    weight_map: { "layer.a.weight": names[0], "layer.b.weight": names[1] } }));
  return fixture;
}

// Rebind deliberately malformed indexes so validation, rather than a hash mismatch, rejects them.
function setShardIndex(fixture, text) {
  const filename = "model.safetensors.index.json";
  const bytes = Buffer.from(text);
  fixture.bodies[filename] = bytes;
  fixture.candidate.weightIndex = { filename, byteCount: bytes.length, sha256: sha256(bytes), gitBlobId: null };
}

test("sharded acquisition retains the index required by the source screen and verifies cached closure", async () => {
  const storage = createSourceAcquisitionFixture();
  const fixture = shardedCandidate();
  const requests = [];
  const fetchImpl = async url => { const name = new URL(url).pathname.split('/').at(-1);
    requests.push(name); return new Response(fixture.bodies[name]); };
  try {
    const receipt = await acquire.acquireCandidate(fixture.candidate, storage.rootPath, { fetchImpl });
    const names = receipt.files.map(file => file.filename);
    assert.ok(names.includes("model.safetensors.index.json"), "verified acquisition must retain the shard index");
    assert.ok(requests.indexOf("model.safetensors.index.json") < requests.indexOf(fixture.candidate.weightFiles[0].filename));
    const directory = acquire.candidateDirectory(storage.rootPath, fixture.candidate);
    const artifacts = require("../tools/source-model-screen-evidence.js").sourceCheckpointArtifacts(directory);
    assert.equal(artifacts.identityKind, "indexed-safetensors-set-v1");
    assert.deepEqual(artifacts.modelFiles.map(file => file.name), ["model.safetensors.index.json",
      ...fixture.candidate.weightFiles.map(file => file.filename)]);
    requests.length = 0;
    assert.deepEqual(await acquire.acquireCandidate(fixture.candidate, storage.rootPath, { fetchImpl }), receipt);
    assert.deepEqual(requests, []);
    fs.writeFileSync(path.join(directory, "model.safetensors.index.json"), Buffer.alloc(fixture.candidate.weightIndex.byteCount, 0x20));
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, storage.rootPath, { fetchImpl }), /SHA-256 mismatch/);
    assert.deepEqual(requests, []);
  } finally { storage.remove(); }
});

test("shard index admission rejects unsafe maps before any other source download", async () => {
  const cases = [
    '{"weight_map":{}}',
    '{"weight_map":{"x":"../outside.safetensors"}}',
    '{"weight_map":{"x":"model-00001-of-00002.safetensors"}}',
    '{"weight_map":{"x":"model-00001-of-00002.safetensors","x":"model-00002-of-00002.safetensors"}}'
  ];
  for (const contents of cases) {
    const fixture = shardedCandidate();
    setShardIndex(fixture, contents);
    const storage = createSourceAcquisitionFixture();
    const requested = [];
    try {
      await assert.rejects(acquire.acquireCandidate(fixture.candidate, storage.rootPath, { fetchImpl: async url => {
        const name = new URL(url).pathname.split('/').at(-1); requested.push(name);
        return new Response(fixture.bodies[name]);
      } }), /weight index/);
      assert.deepEqual(requested, ["model.safetensors.index.json"]);
      assert.equal(fs.existsSync(path.join(acquire.candidateDirectory(storage.rootPath, fixture.candidate),
        "source-acquisition.json")), false);
    } finally { storage.remove(); }
  }
});

test("index identities and obsolete inventories reject before acquisition side effects", async () => {
  const original = shardedCandidate().candidate;
  const storage = createSourceAcquisitionFixture();
  let requests = 0;
  const fetchImpl = async () => { requests++; throw Error("unexpected request"); };
  try {
    for (const candidate of [
      { ...original, weightIndex: undefined }, { ...original, weightIndex: null },
      { ...original, weightIndex: { ...original.weightIndex, filename: "config.json" } },
      { ...original, weightIndex: { ...original.weightIndex, byteCount: 256 * 1024 + 1 } },
      { ...selectionCandidate().candidate, weightIndex: original.weightIndex },
      { ...selectionCandidate().candidate, weightIndex: undefined }
    ]) await assert.rejects(acquire.acquireCandidate(candidate, storage.rootPath, { fetchImpl }), /weight index/);
    await assert.rejects(acquire.acquireInventory({ schema: "tinyrustlm.huggingface_supported_candidate_inventory.v2",
      candidates: [original] }, storage.rootPath, { fetchImpl }), /inventory schema/);
    assert.equal(requests, 0);
    assert.deepEqual(fs.readdirSync(storage.rootPath), [".fixture-owner"]);
  } finally { storage.remove(); }
});

test("Git-blob index verification binds fresh bytes and obsolete receipts never resume", async () => {
  const fixture = shardedCandidate();
  const index = fixture.bodies["model.safetensors.index.json"];
  fixture.candidate.weightIndex.sha256 = null;
  fixture.candidate.weightIndex.gitBlobId = crypto.createHash("sha1").update(`blob ${index.length}\0`).update(index).digest("hex");
  const storage = createSourceAcquisitionFixture();
  const requests = [];
  const fetchImpl = async url => { const name = new URL(url).pathname.split('/').at(-1); requests.push(name);
    return new Response(fixture.bodies[name]); };
  try {
    const receipt = await acquire.acquireCandidate(fixture.candidate, storage.rootPath, { fetchImpl });
    assert.equal(receipt.schema, "tinyrustlm.huggingface_source_acquisition.v3");
    assert.equal(receipt.files.find(file => file.filename === "model.safetensors.index.json").sha256, sha256(index));
    const directory = acquire.candidateDirectory(storage.rootPath, fixture.candidate);
    const receiptPath = path.join(directory, "source-acquisition.json");
    fs.writeFileSync(receiptPath, JSON.stringify({ ...receipt, files: receipt.files.filter(file => file.filename !== "model.safetensors.index.json") }));
    requests.length = 0;
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, storage.rootPath, { fetchImpl }), /file closure/);
    fs.writeFileSync(receiptPath, JSON.stringify({ ...receipt, schema: "tinyrustlm.huggingface_source_acquisition.v2" }));
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, storage.rootPath, { fetchImpl }), /receipt is invalid/);
    assert.deepEqual(requests, []);
  } finally { storage.remove(); }
});

test("invalid explicit acquisition selection never falls back to downloading candidates", async () => {
  const storage = createSourceAcquisitionFixture();
  const inventory = { schema: "tinyrustlm.huggingface_supported_candidate_inventory.v3",
    candidates: [selectionCandidate().candidate] };
  let requests = 0;
  const fetchImpl = async () => { requests++; throw Error("unexpected source request"); };
  try {
    for (const count of [0, NaN, null, false, "", "1", -1, 1.5, Infinity, 101]) {
      await assert.rejects(acquire.acquireInventory(inventory, storage.rootPath, { count, fetchImpl }),
        /candidate count is invalid/, `count=${String(count)}`);
    }
    for (const start of [NaN, null, false, "", "0", -1, 1.5, Infinity]) {
      await assert.rejects(acquire.acquireInventory(inventory, storage.rootPath, { start, fetchImpl }),
        /candidate start is invalid/, `start=${String(start)}`);
    }
    assert.equal(requests, 0);
    assert.deepEqual(fs.readdirSync(storage.rootPath), [".fixture-owner"]);
  } finally { storage.remove(); }
});

test("every selected candidate is validated before the first source request", async () => {
  const storage = createSourceAcquisitionFixture();
  let requests = 0;
  try {
    for (const tail of [{ ...selectionCandidate("Two").candidate, revision: "main" }, null, undefined]) {
      const candidates = [selectionCandidate().candidate];
      candidates.length = 2;
      if (tail !== undefined) candidates[1] = tail;
      await assert.rejects(acquire.acquireInventory({ schema: "tinyrustlm.huggingface_supported_candidate_inventory.v3", candidates },
        storage.rootPath, { fetchImpl: async () => { requests++; throw Error("unexpected source request"); } }),
      /candidate revision is not immutable|candidate is invalid/);
    }
    assert.equal(requests, 0);
    assert.deepEqual(fs.readdirSync(storage.rootPath), [".fixture-owner"]);
  } finally { storage.remove(); }
});

test("acquisition CLI rejects zero, nonnumeric and empty explicit limits without output", () => {
  const metadata = createOwnedTemporaryDirectory({ temporaryParent: path.resolve(__dirname, "../../artifacts/tests/candidate-selection-cli") });
  const storage = createSourceAcquisitionFixture();
  try {
    const inventory = path.join(metadata.rootPath, "inventory.json");
    fs.writeFileSync(inventory, JSON.stringify({ schema: "tinyrustlm.huggingface_supported_candidate_inventory.v3",
      candidates: [{ modelId: "invalid candidate must never be reached" }] }));
    for (const [start, count, message] of [["0", "0", "count"], ["0", "NaN", "count"],
      ["0", "", "count"], ["", "1", "start"], ["NaN", "1", "start"]]) {
      const result = spawnSync(process.execPath, [path.resolve(__dirname, "../tools/huggingface-candidate-acquire.js"),
        inventory, storage.rootPath, start, count], { encoding: "utf8", windowsHide: true, timeout: 10000,
        env: { ...process.env, NODE_V8_COVERAGE: "" } });
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`candidate ${message} is invalid`));
      assert.deepEqual(fs.readdirSync(storage.rootPath), [".fixture-owner"]);
    }
  } finally { storage.remove(); removeOwnedTemporaryDirectory(metadata); }
});

test("acquisition honors explicit slices and omitted selection defaults", async () => {
  for (const [options, expected] of [[{}, ["One", "Two"]], [{ start: 1 }, ["Two"]],
    [{ count: 1 }, ["One"]], [{ start: 1, count: 100 }, ["Two"]]]) {
    const storage = createSourceAcquisitionFixture();
    const one = selectionCandidate("One"), two = selectionCandidate("Two");
    const requests = [];
    try {
      const receipts = await acquire.acquireInventory({ schema: "tinyrustlm.huggingface_supported_candidate_inventory.v3",
        candidates: [one.candidate, two.candidate] }, storage.rootPath, { ...options,
        fetchImpl: async url => { requests.push(String(url)); return new Response(one.bodies[new URL(url).pathname.split('/').at(-1)]); } });
      assert.deepEqual(receipts.map(receipt => receipt.modelId), expected.map(name => `Example/Selection-${name}`));
      assert.equal(requests.length, expected.length * 5);
      for (const name of ["One", "Two"].filter(name => !expected.includes(name))) {
        assert.ok(requests.every(url => !url.includes(`/Selection-${name}/`)));
        assert.equal(fs.existsSync(acquire.candidateDirectory(storage.rootPath, selectionCandidate(name).candidate)), false);
      }
    } finally { storage.remove(); }
  }
});

// Starts a loopback fixture that supports exact byte ranges and records requests.
async function startFixture(routes) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ url: request.url, range: request.headers.range || "" });
    const route = routes[request.url];
    if (!route) {
      response.writeHead(404).end();
      return;
    }
    const bytes = Buffer.isBuffer(route) ? route : route.bytes;
    const gzip = !Buffer.isBuffer(route) && route.gzip === true;
    const maximumResponseBytes = !Buffer.isBuffer(route) &&
      Number.isSafeInteger(route.maximumResponseBytes)
      ? route.maximumResponseBytes
      : null;
    const match = /^bytes=(\d+)-$/.exec(request.headers.range || "");
    const start = match ? Number(match[1]) : 0;
    const sourceBody = bytes.subarray(start);
    const boundedSourceBody = maximumResponseBytes === null
      ? sourceBody
      : sourceBody.subarray(0, maximumResponseBytes);
    const body = gzip ? zlib.gzipSync(boundedSourceBody) : boundedSourceBody;
    response.writeHead(start > 0 ? 206 : 200, {
      ...(maximumResponseBytes === null ? { "content-length": body.length } : {}),
      ...(maximumResponseBytes === null ? {} : { "transfer-encoding": "chunked" }),
      ...(gzip ? { "content-encoding": "gzip" } : {}),
      ...(start > 0 ? {
        "content-range": `bytes ${start}-${start + boundedSourceBody.length - 1}/${bytes.length}`
      } : {})
    });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

test("resumes pinned files, verifies every digest, and reuses a complete receipt", async () => {
  const revision = "a".repeat(40);
  const modelId = "Example/Qwen3-0.6B-Dialog-SFT";
  const weight = Buffer.alloc(1_048_777, 0x5a);
  const config = Buffer.from('{"model_type":"qwen3"}\n');
  const tokenizer = Buffer.from('{"model":{"type":"BPE"}}\n');
  const chatTemplate = "{% for message in messages %}<|im_start|>{{ message.role }} {{ message.content }}<|im_end|>{% endfor %}<|im_start|>assistant";
  const tokenizerConfig = Buffer.from(`${JSON.stringify({ chat_template: chatTemplate })}\n`);
  const license = Buffer.from("Apache License\nVersion 2.0, January 2004\n");
  const modelRoot = `/Example/Qwen3-0.6B-Dialog-SFT/resolve/${revision}`;
  const fixture = await startFixture({
    [`${modelRoot}/model.safetensors`]: weight,
    [`${modelRoot}/config.json`]: config,
    [`${modelRoot}/tokenizer.json`]: { bytes: tokenizer, gzip: true },
    [`${modelRoot}/tokenizer_config.json`]: tokenizerConfig,
    "/LICENSE-2.0.txt": license
  });
  const storage = createSourceAcquisitionFixture();
  const outputRoot = storage.rootPath;
  const candidate = {
    sourceTemplate: "qwen3-0.6b-bpe",
    modelId,
    revision,
    licenseId: "apache-2.0",
    licenseEvidenceKind: "revision-metadata-plus-apache-authority-text",
    licenseSourceUrl: `${fixture.baseUrl}/LICENSE-2.0.txt`,
    licenseSha256: sha256(license),
    configSha256: sha256(config),
    tokenizer: {
      filename: "tokenizer.json",
      byteCount: tokenizer.length,
      sha256: sha256(tokenizer),
      gitBlobId: null
    },
    tokenizerConfig: {
      filename: "tokenizer_config.json",
      byteCount: tokenizerConfig.length,
      sha256: sha256(tokenizerConfig),
      gitBlobId: null
    },
    chatTemplateKind: "revision-chatml-template-v1",
    chatTemplateSha256: sha256(Buffer.from(chatTemplate)),
    sourceWeightByteCount: weight.length,
    weightIdentity: sha256(Buffer.from(`model.safetensors:${weight.length}:${sha256(weight)}`)),
    weightIndex: null,
    weightFiles: [{ filename: "model.safetensors", byteCount: weight.length, sha256: sha256(weight) }]
  };

  try {
    const directory = acquire.candidateDirectory(outputRoot, candidate);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "model.safetensors.part"), weight.subarray(0, 173));

    const first = await acquire.acquireCandidate(candidate, outputRoot, { baseUrl: fixture.baseUrl });
    assert.equal(first.status, "verified");
    assert.equal(first.modelId, modelId);
    assert.equal(first.sourceTemplate, "qwen3-0.6b-bpe");
    assert.equal(fs.readFileSync(path.join(directory, "model.safetensors")).equals(weight), true);
    assert.equal(fixture.requests.some((request) => request.range === "bytes=173-"), true);
    const firstRequestCount = fixture.requests.length;

    const second = await acquire.acquireCandidate(candidate, outputRoot, { baseUrl: fixture.baseUrl });
    assert.deepEqual(second, first);
    assert.equal(fixture.requests.length, firstRequestCount);
    assert.equal(JSON.stringify(second).includes("agentToken"), false);
    assert.equal(JSON.stringify(second).includes("authorization"), false);
  } finally {
    await fixture.close();
    storage.remove();
  }
});

test("rejects a downloaded source whose pinned digest does not match", async () => {
  const bytes = Buffer.from("wrong source bytes");
  const revision = "b".repeat(40);
  const chatTemplate = "{% for message in messages %}<|im_start|>{{ message.role }} {{ message.content }}<|im_end|>{% endfor %}";
  const tokenizerConfig = Buffer.from(JSON.stringify({ chat_template: chatTemplate }));
  const fixture = await startFixture({
    [`/Example/Bad/resolve/${revision}/model.safetensors`]: bytes,
    [`/Example/Bad/resolve/${revision}/config.json`]: Buffer.from("{}"),
    [`/Example/Bad/resolve/${revision}/tokenizer.json`]: Buffer.from("{}"),
    [`/Example/Bad/resolve/${revision}/tokenizer_config.json`]: tokenizerConfig,
    "/LICENSE-2.0.txt": Buffer.from("Apache License\nVersion 2.0\n")
  });
  const storage = createSourceAcquisitionFixture();
  const outputRoot = storage.rootPath;
  const candidate = {
    sourceTemplate: "qwen3-0.6b-bpe",
    modelId: "Example/Bad",
    revision,
    licenseId: "apache-2.0",
    licenseEvidenceKind: "revision-metadata-plus-apache-authority-text",
    licenseSourceUrl: `${fixture.baseUrl}/LICENSE-2.0.txt`,
    licenseSha256: sha256(Buffer.from("Apache License\nVersion 2.0\n")),
    configSha256: sha256(Buffer.from("{}")),
    tokenizer: { filename: "tokenizer.json", byteCount: 2, sha256: sha256(Buffer.from("{}")), gitBlobId: null },
    tokenizerConfig: {
      filename: "tokenizer_config.json",
      byteCount: tokenizerConfig.length,
      sha256: sha256(tokenizerConfig),
      gitBlobId: null
    },
    chatTemplateKind: "revision-chatml-template-v1",
    chatTemplateSha256: sha256(Buffer.from(chatTemplate)),
    sourceWeightByteCount: bytes.length,
    weightIdentity: sha256(Buffer.from(`model.safetensors:${bytes.length}:${"d".repeat(64)}`)),
    weightIndex: null,
    weightFiles: [{ filename: "model.safetensors", byteCount: bytes.length, sha256: "d".repeat(64) }]
  };

  try {
    await assert.rejects(
      () => acquire.acquireCandidate(candidate, outputRoot, { baseUrl: fixture.baseUrl }),
      /SHA-256 mismatch/i
    );
    assert.equal(fs.existsSync(path.join(acquire.candidateDirectory(outputRoot, candidate), "source-acquisition.json")), false);
  } finally {
    await fixture.close();
    storage.remove();
  }
});

test("preserves repeated short reads and resumes them on the next acquisition", async () => {
  const revision = "e".repeat(40);
  const modelId = "Example/Qwen3-0.6B-Short-Read-SFT";
  const weight = Buffer.alloc(4097, 0x37);
  const config = Buffer.from('{"model_type":"qwen3"}\n');
  const tokenizer = Buffer.from('{"model":{"type":"BPE"}}\n');
  const chatTemplate = "{% for message in messages %}<|im_start|>{{ message.role }} {{ message.content }}<|im_end|>{% endfor %}<|im_start|>assistant";
  const tokenizerConfig = Buffer.from(`${JSON.stringify({ chat_template: chatTemplate })}\n`);
  const license = Buffer.from("Apache License\nVersion 2.0, January 2004\n");
  const modelRoot = `/Example/Qwen3-0.6B-Short-Read-SFT/resolve/${revision}`;
  const weightRoute = { bytes: weight, maximumResponseBytes: 257 };
  const fixture = await startFixture({
    [`${modelRoot}/model.safetensors`]: weightRoute,
    [`${modelRoot}/config.json`]: config,
    [`${modelRoot}/tokenizer.json`]: tokenizer,
    [`${modelRoot}/tokenizer_config.json`]: tokenizerConfig,
    "/LICENSE-2.0.txt": license
  });
  const storage = createSourceAcquisitionFixture();
  const outputRoot = storage.rootPath;
  const candidate = {
    sourceTemplate: "qwen3-0.6b-bpe",
    modelId,
    revision,
    licenseId: "apache-2.0",
    licenseEvidenceKind: "revision-metadata-plus-apache-authority-text",
    licenseSourceUrl: `${fixture.baseUrl}/LICENSE-2.0.txt`,
    licenseSha256: sha256(license),
    configSha256: sha256(config),
    tokenizer: {
      filename: "tokenizer.json",
      byteCount: tokenizer.length,
      sha256: sha256(tokenizer),
      gitBlobId: null
    },
    tokenizerConfig: {
      filename: "tokenizer_config.json",
      byteCount: tokenizerConfig.length,
      sha256: sha256(tokenizerConfig),
      gitBlobId: null
    },
    chatTemplateKind: "revision-chatml-template-v1",
    chatTemplateSha256: sha256(Buffer.from(chatTemplate)),
    sourceWeightByteCount: weight.length,
    weightIdentity: sha256(Buffer.from(`model.safetensors:${weight.length}:${sha256(weight)}`)),
    weightIndex: null,
    weightFiles: [{ filename: "model.safetensors", byteCount: weight.length, sha256: sha256(weight) }]
  };

  try {
    const directory = acquire.candidateDirectory(outputRoot, candidate);
    await assert.rejects(
      () => acquire.acquireCandidate(candidate, outputRoot, { baseUrl: fixture.baseUrl }),
      /download ended early/i
    );
    const partPath = path.join(directory, "model.safetensors.part");
    assert.equal(fs.statSync(partPath).size, 4 * weightRoute.maximumResponseBytes);
    assert.equal(fs.existsSync(path.join(directory, "source-acquisition.json")), false);

    weightRoute.maximumResponseBytes = null;
    const receipt = await acquire.acquireCandidate(candidate, outputRoot, { baseUrl: fixture.baseUrl });
    assert.equal(receipt.status, "verified");
    assert.equal(fs.existsSync(partPath), false);
    assert.equal(fs.readFileSync(path.join(directory, "model.safetensors")).equals(weight), true);
    assert.equal(fixture.requests.some((request) => request.range === "bytes=1028-"), true);
  } finally {
    await fixture.close();
    storage.remove();
  }
});
