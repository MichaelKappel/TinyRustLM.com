"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { MemoryEndpointsHttpClient, readJsonResponse, maximumResponseBytes } = require("../app/memory-endpoints-http.js");
const lifetimeApi = require("../app/operation-lifetime.js");
const origin = "https://memory.example/api/matm/memory-events";

/** Model a streamed response, recording cleanup without allocating a large body. */
function response(chunks, options = {}) {
  const state = { reads: 0, cancelled: 0, released: 0 };
  const reader = {
    read() { const value = chunks[state.reads++]; return options.read ? options.read(state) : Promise.resolve(value === undefined ? { done: true } : { done: false, value }); },
    cancel() { state.cancelled += 1; return options.cancel ? options.cancel() : Promise.resolve(); },
    releaseLock() { state.released += 1; }
  };
  return { state, ok: options.status === undefined || options.status === 200, status: options.status || 200,
    headers: { get: () => options.length === undefined ? null : options.length },
    body: { getReader: () => reader, cancel: () => reader.cancel() } };
}

/** Encode public fixture JSON into the same UTF-8 bytes supplied by Fetch readers. */
function json(text = '{"ok":true}') { return new TextEncoder().encode(text); }

test("request preserves exact query, body and headers without redirects, cookies or retries", async () => {
  const calls = [];
  const client = new MemoryEndpointsHttpClient({ fetch: async (...args) => { calls.push(args); return response([json()]); } });
  const result = await client.request(origin + "?query=a%2Bb", {
    method: "POST", payload: { title: "Public fixture" }, headers: { "Idempotency-Key": "fixture-original-key" }
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, origin + "?query=a%2Bb");
  assert.equal(options.body, '{"title":"Public fixture"}');
  assert.equal(options.headers["Idempotency-Key"], "fixture-original-key");
  assert.equal(options.headers.Accept, "application/json");
  assert.equal(options.redirect, "error");
  assert.equal(options.credentials, "omit");
  assert.equal(options.cache, "no-store");
});

test("invalid settings, destinations, methods and signals reject before network", async () => {
  let calls = 0;
  const fetch = async () => { calls += 1; return response([json()]); };
  for (const timeoutMilliseconds of [0, -1, 120001, NaN, "30"]) {
    assert.throws(() => new MemoryEndpointsHttpClient({ fetch, timeoutMilliseconds }), { code: "invalid_memory_request" });
  }
  for (const limit of [0, maximumResponseBytes + 1, NaN, "16"]) {
    assert.throws(() => new MemoryEndpointsHttpClient({ fetch, maximumResponseBytes: limit }), { code: "invalid_memory_request" });
  }
  assert.throws(() => new MemoryEndpointsHttpClient({ fetch: {} }), { code: "invalid_memory_request" });
  assert.throws(() => new MemoryEndpointsHttpClient({ fetch: null }), { code: "invalid_memory_request" });
  const client = new MemoryEndpointsHttpClient({ fetch });
  for (const url of ["bad", "http://memory.example/", "file:///data", "https://user@memory.example/", origin + "#fragment"]) {
    await assert.rejects(client.request(url), { code: "invalid_memory_request" });
  }
  await assert.rejects(client.request(origin, { method: "DELETE" }), { code: "invalid_memory_request" });
  await assert.rejects(client.request(origin, { method: null }), { code: "invalid_memory_request" });
  for (const signal of [null, {}, { aborted: false }]) await assert.rejects(client.request(origin, { signal }), { code: "invalid_memory_request" });
  assert.equal(calls, 0);
});

test("deadline bounds uncooperative Fetch and cancels a late body", async () => {
  let release;
  const body = response([json()]);
  const client = new MemoryEndpointsHttpClient({ timeoutMilliseconds: 20, fetch: () => new Promise(resolve => { release = resolve; }) });
  await assert.rejects(client.request(origin), { code: "memory_timeout" });
  release(body);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(body.state.cancelled, 1);
  assert.equal(body.state.reads, 0);
});

test("caller abort before Fetch is a zero-request operation", async () => {
  let calls = 0;
  const controller = new AbortController(); controller.abort();
  const client = new MemoryEndpointsHttpClient({ fetch: () => { calls += 1; } });
  await assert.rejects(client.request(origin, { signal: controller.signal }), { code: "memory_cancelled" });
  assert.equal(calls, 0);
});

test("caller abort and deadline bound pending reads even when cancellation never settles", async () => {
  for (const mode of ["abort", "timeout"]) {
    const controller = new AbortController();
    const body = response([], { read: () => new Promise(() => {}), cancel: () => new Promise(() => {}) });
    const client = new MemoryEndpointsHttpClient({ timeoutMilliseconds: mode === "timeout" ? 20 : 1000, fetch: async () => body });
    const result = client.request(origin, { signal: controller.signal });
    if (mode === "abort") setImmediate(() => controller.abort());
    await assert.rejects(result, { code: mode === "timeout" ? "memory_timeout" : "memory_cancelled" });
    assert.equal(body.state.cancelled, 1);
    assert.equal(body.state.released, 1);
  }
});

test("declared and streamed byte limits reject before retaining excess bytes", async () => {
  for (const [chunks, options, code] of [
    [[json()], { length: "100" }, "response_too_large"],
    [[json()], { length: "invalid" }, "invalid_response"],
    [[json()], { length: "9007199254740992" }, "invalid_response"],
    [[json()], { length: "-1" }, "invalid_response"],
    [[json("123456789")], {}, "response_too_large"],
    [[json("1234"), json("56789")], {}, "response_too_large"]
  ]) {
    const body = response(chunks, options);
    const client = new MemoryEndpointsHttpClient({ maximumResponseBytes: 8, fetch: async () => body });
    await assert.rejects(client.request(origin), { code });
    assert.equal(body.state.cancelled, 1);
    if (options.length) assert.equal(body.state.reads, 0);
  }
  const body = response([json("{\"x\":1}")], { length: "7" });
  assert.deepEqual(await new MemoryEndpointsHttpClient({ maximumResponseBytes: 7, fetch: async () => body }).request(origin), { x: 1 });
});

test("empty chunks count toward the stream work limit", async () => {
  const body = response(Array.from({ length: 4097 }, () => new Uint8Array()));
  await assert.rejects(new MemoryEndpointsHttpClient({ fetch: async () => body }).request(origin), { code: "response_too_large" });
  assert.equal(body.state.reads, 4097);
  assert.equal(body.state.cancelled, 1);
});

test("invalid JSON, UTF-8, scalars, arrays and absent bodies never become success", async () => {
  for (const chunks of [[], [json("broken")], [json("null")], [json("[]")], [json("true")], [new Uint8Array([0xff])], ["not-bytes"]]) {
    await assert.rejects(new MemoryEndpointsHttpClient({ fetch: async () => response(chunks) }).request(origin), { code: "invalid_response" });
  }
  await assert.rejects(new MemoryEndpointsHttpClient({ fetch: async () => ({ ok: true, body: null }) }).request(origin), { code: "invalid_response" });
});

test("network and HTTP failures never expose the response or silently retry POST", async () => {
  let calls = 0;
  const client = new MemoryEndpointsHttpClient({ fetch: async () => { calls += 1; throw new Error("private remote detail"); } });
  await assert.rejects(client.request(origin, { method: "POST", payload: {} }), error => error.code === "memory_request_failed" && !error.message.includes("private"));
  assert.equal(calls, 1);
  const body = response([json("private response")], { status: 503 });
  await assert.rejects(new MemoryEndpointsHttpClient({ fetch: async () => body }).request(origin), { code: "memory_http_error" });
  assert.equal(body.state.reads, 0);
  assert.equal(body.state.cancelled, 1);
});

test("shared reader validates caller budgets and preserves enrollment error identity", async () => {
  const error = (code, message) => Object.assign(new Error(message), { code });
  const lifetime = lifetimeApi.create({ timeoutMilliseconds: 1000, optionsError: error("options", "options"), abortError: error("abort", "abort"), timeoutError: error("timeout", "timeout") });
  try {
    for (const changes of [{ maximumResponseBytes: 0 }, { maximumResponseChunks: 0 }, { maximumResponseChunks: 4097 }]) {
      await assert.rejects(readJsonResponse(response([json()]), { lifetime, error, label: "Enrollment", maximumResponseBytes: 1024, maximumResponseChunks: 4096, ...changes }), { code: "invalid_response_options" });
    }
    assert.deepEqual(await readJsonResponse(response([json()]), { lifetime, error, label: "Enrollment", maximumResponseBytes: 1024, maximumResponseChunks: 4096 }), { ok: true });
  } finally { lifetime.dispose(); }
});
