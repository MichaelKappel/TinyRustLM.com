"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { gzipSync } = require("node:zlib");
const test = require("node:test");
const { createMetadataReader } = require("../tools/huggingface-metadata.js");
const supported = require("../tools/huggingface-supported-candidates.js");
const qwen = require("../tools/huggingface-qwen-candidates.js");

/** Expose chunk reads and cancellation without prefetching before the reader asks. */
function streamed(chunks, headers = {}) {
  const state = { reads: 0, cancelled: false };
  const body = new ReadableStream({
    pull(controller) {
      const chunk = chunks[state.reads++];
      if (chunk === undefined) controller.close();
      else controller.enqueue(chunk);
    },
    cancel() { state.cancelled = true; }
  }, { highWaterMark: 0 });
  return { response: new Response(body, { headers }), state };
}

test("streamed text preserves split Unicode, whitespace and BOM bytes at the exact limit", async () => {
  const bytes = Buffer.from("\ufeffA😀é\r\n");
  const { response, state } = streamed(Array.from(bytes, (byte) => Uint8Array.of(byte)));
  const reader = createMetadataReader(async (url, options) => {
    assert.equal(url, "https://example.test/config");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "follow");
    assert.equal(options.signal.aborted, false);
    return response;
  });
  assert.deepEqual(Buffer.from(await reader.text("https://example.test/config", "config", bytes.length)), bytes);
  assert.equal(state.cancelled, false);
  assert.equal(response.body.locked, false);
  assert.deepEqual(await createMetadataReader(async () => Response.json({ value: 2 })).json("url", "JSON"), { value: 2 });
});

test("advertised oversize refuses before body reads; actual bytes defeat a lying length", async () => {
  for (const [length, reads] of [["5", 0], ["1", 2], [undefined, 2]]) {
    const { response, state } = streamed([Buffer.from("1234"), Buffer.from("5"), Buffer.from("unread")],
      length === undefined ? {} : { "content-length": length });
    await assert.rejects(createMetadataReader(async () => response).text("url", "license", 4),
      { name: "MetadataReadError", code: "metadata_oversized", message: "license: metadata_oversized" });
    assert.equal(state.reads, reads);
    assert.equal(state.cancelled, true);
    assert.equal(response.body.locked, false);
  }
});

test("default text and JSON limits count original whitespace before parsing", async () => {
  const text = "x".repeat(1024 * 1024);
  assert.equal((await createMetadataReader(async () => new Response(text)).text("url", "text")).length, text.length);
  await assert.rejects(createMetadataReader(async () => new Response(text + "x")).text("url", "text"),
    { code: "metadata_oversized" });
  const paddedJson = " ".repeat(16 * 1024 * 1024 - 2) + "[]";
  assert.deepEqual(await createMetadataReader(async () => new Response(paddedJson)).json("url", "JSON"), []);
  await assert.rejects(createMetadataReader(async () => new Response(paddedJson + " ")).json("url", "JSON"),
    { code: "metadata_oversized" });
});

test("invalid lengths, bytes, UTF-8, JSON and HTTP status fail with evidence error codes", async () => {
  for (const length of ["no", "-1", "1.5", "9007199254740992"]) {
    await assert.rejects(createMetadataReader(async () => new Response("x", { headers: { "content-length": length } }))
      .text("url", "data"), { code: "metadata_invalid_response" });
  }
  for (const [response, code] of [
    [new Response(null), "metadata_invalid_response"],
    [new Response("error", { status: 503 }), "metadata_http_error"],
    [streamed(["not bytes"]).response, "metadata_invalid_response"],
    [new Response(Uint8Array.of(0xc3, 0x28)), "metadata_invalid_utf8"]
  ]) {
    await assert.rejects(createMetadataReader(async () => response).text("url", "data"), { code });
  }
  await assert.rejects(createMetadataReader(async () => new Response("{")).json("url", "JSON"),
    { code: "metadata_invalid_json" });
  await assert.rejects(createMetadataReader(async () => { throw new Error("private transport detail"); }).text("url", "data"),
    { code: "metadata_request_failed", message: "data: metadata_request_failed" });
  const response = new Response(new ReadableStream({ start(controller) { controller.error(new Error("broken body")); } }));
  await assert.rejects(createMetadataReader(async () => response).text("url", "data"), { code: "metadata_request_failed" });
});

test("invalid fetch, timeout and byte bounds reject before issuing requests", async () => {
  let fetched = false;
  const fetchImpl = async () => { fetched = true; return new Response("x"); };
  assert.throws(() => createMetadataReader(null), /implementation or request timeout/);
  for (const value of [null, 0, -1, 1.5, NaN, Infinity, "1000", 120001]) {
    assert.throws(() => createMetadataReader(fetchImpl, value), /implementation or request timeout/);
  }
  const reader = createMetadataReader(fetchImpl, 120000);
  for (const value of [null, 0, -1, 1.5, Infinity, 16 * 1024 * 1024 + 1]) {
    await assert.rejects(reader.text("url", "text", value), /byte limit/);
  }
  assert.equal(fetched, false);
});

test("deadline settles a noncooperative fetch and cancels its late response", async () => {
  let finish;
  let signal;
  const reader = createMetadataReader((_url, options) => {
    signal = options.signal;
    return new Promise((resolve) => { finish = resolve; });
  }, 25);
  await assert.rejects(reader.text("url", "headers"), { code: "metadata_timeout" });
  assert.equal(signal.aborted, true);
  const { response, state } = streamed([Buffer.from("late")]);
  finish(response);
  await new Promise(setImmediate);
  assert.equal(state.cancelled, true);
  assert.equal(state.reads, 0);
});

test("deadline includes a stalled body and does not await stalled cancellation", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    pull() { return new Promise(() => {}); },
    cancel() { cancelled = true; return new Promise(() => {}); }
  }));
  const start = performance.now();
  await assert.rejects(createMetadataReader(async () => response, 25).text("url", "body"), { code: "metadata_timeout" });
  assert.equal(cancelled, true);
  assert.equal(response.body.locked, false);
  assert.ok(performance.now() - start < 2000);
});

test("native HTTP fetch enforces deadlines, decompressed limits and truncated-body rejection", { timeout: 10000 }, async () => {
  const stalledClosed = new Set();
  const server = http.createServer((request, response) => {
    response.on("close", () => { if (request.url.includes("stall")) stalledClosed.add(request.url); });
    if (request.url === "/headers-stall") return;
    if (request.url === "/body-stall") { response.writeHead(200); response.flushHeaders(); return; }
    if (request.url === "/gzip") {
      const body = gzipSync(Buffer.alloc(1025, 120));
      response.writeHead(200, { "Content-Encoding": "gzip", "Content-Length": body.length });
      response.end(body);
      return;
    }
    if (request.url === "/truncated") {
      response.writeHead(200, { "Content-Length": 100, Connection: "close" });
      response.end("short");
      return;
    }
    response.end("{\"ok\":true}");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const reader = createMetadataReader(globalThis.fetch, 250);
  try {
    assert.deepEqual(await reader.json(base + "/ok", "JSON"), { ok: true });
    for (const route of ["/headers-stall", "/body-stall"]) {
      await assert.rejects(reader.text(base + route, route), { code: "metadata_timeout" });
    }
    await assert.rejects(reader.text(base + "/gzip", "gzip", 1024), { code: "metadata_oversized" });
    await assert.rejects(reader.text(base + "/truncated", "truncated", 1024), { code: "metadata_request_failed" });
    // These subsequent requests also give the server time to observe both aborted sockets.
    assert.deepEqual(stalledClosed, new Set(["/headers-stall", "/body-stall"]));
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
});

/** Supply enough valid pinned evidence to reach each owner's license request. */
function candidateFetch(licenseResponse, calls) {
  const modelId = "Example/Qwen2.5-1.5B-Instruct";
  const revision = "a".repeat(40);
  const config = { model_type: "qwen2", architectures: ["Qwen2ForCausalLM"],
    ...supported.profiles["qwen2.5-1.5b-bpe"].config };
  return async (url) => {
    calls.push(url);
    if (url.includes("/api/models?")) return Response.json([{ id: modelId, sha: revision, config,
      pipeline_tag: "text-generation", tags: ["safetensors", "license:apache-2.0"] }]);
    if (url.includes("/revision/")) return Response.json({ id: modelId, sha: revision,
      cardData: { license: "apache-2.0" }, siblings: [
        ...["config.json", "tokenizer.json", "tokenizer_config.json", "LICENSE"].map((rfilename) =>
          ({ rfilename, size: 100, blobId: "c".repeat(40) })),
        { rfilename: "model.safetensors", lfs: { size: 3_000_000_000, sha256: "b".repeat(64) } }
      ] });
    if (url.endsWith("/config.json")) return Response.json(config);
    if (url.endsWith("/tokenizer_config.json")) return Response.json({
      chat_template: "{% for message in messages %}<|im_start|>{{ message.role }}<|im_end|>{% endfor %}" });
    return licenseResponse();
  };
}

for (const [name, discovery] of [["supported", supported], ["qwen", qwen]]) {
  test(`${name} bounds server search rows and propagates its timeout before model requests`, async () => {
    let fetched = 0;
    await assert.rejects(discovery.discoverCandidates({ profileId: "qwen2.5-1.5b-bpe", searchLimit: 1,
      fetchImpl: async () => { fetched++; return Response.json([{}, {}]); } }), /exceeds requested result limit/);
    assert.equal(fetched, 1);
    await assert.rejects(discovery.discoverCandidates({ profileId: "qwen2.5-1.5b-bpe", requestTimeoutMs: 25,
      fetchImpl: async () => new Response(new ReadableStream({ pull() { return new Promise(() => {}); } })) }),
    { code: "metadata_timeout" });
  });
  test(`${name} distinguishes license fetch failures from license judgments without retrying`, async () => {
    for (const [makeResponse, code] of [
      [() => new Response("x", { headers: { "Content-Length": 1024 * 1024 + 1 } }), "metadata_oversized"],
      [() => new Response(new ReadableStream({ pull() { return new Promise(() => {}); } })), "metadata_timeout"]
    ]) {
      const calls = [];
      const report = await discovery.discoverCandidates({ profileId: "qwen2.5-1.5b-bpe", requestTimeoutMs: 25,
        fetchImpl: candidateFetch(makeResponse, calls) });
      assert.equal(report.candidates.length, 0);
      assert.deepEqual(report.rejections, [{ modelId: "Example/Qwen2.5-1.5B-Instruct", code }]);
      assert.equal(calls.length, name === "supported" ? 5 : 4);
    }
  });
}
