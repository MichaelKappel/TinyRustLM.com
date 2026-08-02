"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

const acquire = require("../tools/huggingface-candidate-acquire.js");

// Hashes fixture bytes using the source acquisition digest contract.
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

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
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-acquire-"));
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
    fs.rmSync(outputRoot, { recursive: true, force: true });
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
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-acquire-"));
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
    weightIdentity: "c".repeat(64),
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
    fs.rmSync(outputRoot, { recursive: true, force: true });
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
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-short-read-"));
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
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
});
