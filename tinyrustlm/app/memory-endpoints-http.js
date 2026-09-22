(function (root, factory) {
  "use strict";
  const lifetime = typeof module === "object" && module.exports
    ? require("./operation-lifetime.js") : root.TinyRustLMOperationLifetime;
  const api = factory(lifetime);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TinyRustLMMemoryEndpointsHttp = api;
})(typeof globalThis === "object" ? globalThis : this, function (lifetimeApi) {
  "use strict";

  const maximumResponseBytes = 16 * 1024 * 1024;
  const maximumResponseChunks = 4096;
  const defaultTimeoutMilliseconds = 30_000;

  /** Typed, body-free diagnostics distinguish stopping from invalid or failed responses. */
  class MemoryEndpointsHttpError extends Error {
    constructor(code, message) { super(message); this.name = "MemoryEndpointsHttpError"; this.code = code; }
  }

  /** Build a safe diagnostic without reflecting response text, URLs or credentials. */
  function httpError(code, message) { return new MemoryEndpointsHttpError(code, message); }

  /** Observe cleanup failure without waiting indefinitely on an abandoned body or reader. */
  function cancelBody(body) {
    try { Promise.resolve(body && body.cancel()).catch(() => {}); } catch (_error) { /* Closed or locked. */ }
  }

  /** Stream a JSON object under the caller's existing deadline and validated byte/chunk budgets. */
  async function readJsonResponse(response, options) {
    const { lifetime, label, error } = options;
    const byteLimit = options.maximumResponseBytes;
    const chunkLimit = options.maximumResponseChunks;
    if (!Number.isInteger(byteLimit) || byteLimit < 1 || byteLimit > maximumResponseBytes ||
        !Number.isInteger(chunkLimit) || chunkLimit < 1 || chunkLimit > maximumResponseChunks) {
      throw error("invalid_response_options", "Memory response limits are invalid");
    }
    const declared = response.headers && response.headers.get ? response.headers.get("Content-Length") : null;
    if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) {
      cancelBody(response.body);
      throw error("invalid_response", `${label} returned an invalid response length`);
    }
    if (declared !== null && Number(declared) > byteLimit) {
      cancelBody(response.body);
      throw error("response_too_large", `${label} exceeded the response limit`);
    }
    if (!response.body || typeof response.body.getReader !== "function") {
      cancelBody(response.body);
      throw error("invalid_response", `${label} requires a readable response body`);
    }
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    let count = 0;
    let complete = false;
    try {
      while (true) {
        const item = await lifetime.wait(() => reader.read());
        if (item.done) { complete = true; break; }
        if (!(item.value instanceof Uint8Array)) throw error("invalid_response", `${label} returned invalid response bytes`);
        if (++count > chunkLimit || item.value.byteLength > byteLimit - length) {
          throw error("response_too_large", `${label} exceeded the response limit`);
        }
        length += item.value.byteLength;
        if (item.value.byteLength) chunks.push(item.value.slice());
      }
    } finally {
      if (!complete) cancelBody(reader);
      try { reader.releaseLock(); } catch (_error) { /* Cancellation owns a pending read. */ }
    }
    if (!length) throw error("invalid_response", `${label} returned an invalid response length`);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (_error) { throw error("invalid_response", `${label} did not return valid UTF-8`); }
    let payload;
    try { payload = JSON.parse(text); }
    catch (_error) { throw error("invalid_response", `${label} did not return valid JSON`); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw error("invalid_response", `${label} is missing a JSON object`);
    }
    return payload;
  }

  /** Request one exact service URL without redirects or retries, under a finite response lifetime. */
  class MemoryEndpointsHttpClient {
    constructor(options = {}) {
      this.fetch = options.fetch === undefined ? (typeof fetch === "function" ? fetch.bind(globalThis) : null) : options.fetch;
      this.timeoutMilliseconds = options.timeoutMilliseconds === undefined ? defaultTimeoutMilliseconds : options.timeoutMilliseconds;
      this.maximumResponseBytes = options.maximumResponseBytes === undefined ? maximumResponseBytes : options.maximumResponseBytes;
      if (typeof this.fetch !== "function" || !lifetimeApi || typeof lifetimeApi.create !== "function" ||
          !Number.isInteger(this.timeoutMilliseconds) || this.timeoutMilliseconds < 1 || this.timeoutMilliseconds > 120_000 ||
          !Number.isInteger(this.maximumResponseBytes) || this.maximumResponseBytes < 1 || this.maximumResponseBytes > maximumResponseBytes) {
        throw httpError("invalid_memory_request", "Web memory request settings are invalid");
      }
    }

    /** Preserve the caller's cancellation signal from Fetch through the final streamed JSON byte. */
    async request(url, options = {}) {
      let target;
      try { target = new URL(url); } catch (_error) { throw httpError("invalid_memory_request", "Web memory URL is invalid"); }
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
      const method = options.method === undefined ? "GET" : options.method;
      const signal = options.signal;
      if ((target.protocol !== "https:" && !(target.protocol === "http:" && loopback)) ||
          target.username || target.password || target.hash || !["GET", "POST"].includes(method) ||
          (signal !== undefined && (!signal || typeof signal.aborted !== "boolean" ||
            typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function"))) {
        throw httpError("invalid_memory_request", "Web memory request is invalid");
      }
      const lifetime = lifetimeApi.create({ signal, timeoutMilliseconds: this.timeoutMilliseconds,
        optionsError: httpError("invalid_memory_request", "Web memory request lifetime is unavailable"),
        abortError: httpError("memory_cancelled", "Web memory request was cancelled"),
        timeoutError: httpError("memory_timeout", "Web memory request timed out") });
      let failure;
      try {
        const headers = { Accept: "application/json", ...options.headers };
        let body;
        if (options.payload !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(options.payload); }
        const response = await lifetime.wait(() => Promise.resolve(this.fetch(target.href, {
          method, headers, body, signal: lifetime.signal, cache: "no-store", credentials: "omit", redirect: "error"
        })).then(value => { if (lifetime.signal.aborted) cancelBody(value && value.body); return value; }));
        if (!response.ok) {
          cancelBody(response.body);
          throw httpError("memory_http_error", `Web memory request failed with HTTP ${response.status}`);
        }
        return await readJsonResponse(response, { lifetime, label: "Web memory", error: httpError,
          maximumResponseBytes: this.maximumResponseBytes, maximumResponseChunks });
      } catch (error) {
        failure = error instanceof MemoryEndpointsHttpError ? error : httpError("memory_request_failed", "Web memory request failed");
        throw failure;
      } finally { lifetime.dispose(failure); }
    }
  }

  return Object.freeze({ MemoryEndpointsHttpClient, MemoryEndpointsHttpError, readJsonResponse, cancelBody,
    maximumResponseBytes, maximumResponseChunks, defaultTimeoutMilliseconds });
});
