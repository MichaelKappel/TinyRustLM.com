(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TinyRustLMBrowserRuntimeLoader = api;
  }
}(typeof globalThis === "object" ? globalThis : this, function (root) {
  "use strict";

  const MANIFEST_SCHEMA = "tinyrustlm.browser-runtime-wasm-manifest/1";
  const PROFILE_ID = "tinyrustlm.browser-runtime-wasm/1";
  const WORKER_PROTOCOL = "tinyrustlm.model-runtime-worker/1";
  const MAXIMUM_MANIFEST_BYTES = 16 * 1024;
  const MAXIMUM_WASM_BYTES = 16 * 1024 * 1024;
  const MAXIMUM_MEMORY_BYTES = 3 * 1024 * 1024 * 1024;
  const MANIFEST_FIELDS = Object.freeze([
    "schema",
    "profileId",
    "workerProtocol",
    "sourceCrate",
    "buildProfile",
    "byteCount",
    "sha256",
    "maximumMemoryBytes",
    "imports",
    "exports",
    "requiredNextGate"
  ]);
  const REQUIRED_EXPORTS = Object.freeze([
    "memory",
    "tinyrustlm_browser_runtime_abi_version",
    "tinyrustlm_browser_runtime_activate",
    "tinyrustlm_browser_runtime_advance_operation",
    "tinyrustlm_browser_runtime_begin_request",
    "tinyrustlm_browser_runtime_create",
    "tinyrustlm_browser_runtime_error_len",
    "tinyrustlm_browser_runtime_error_ptr",
    "tinyrustlm_browser_runtime_finish",
    "tinyrustlm_browser_runtime_release",
    "tinyrustlm_browser_runtime_result_len",
    "tinyrustlm_browser_runtime_result_ptr",
    "tinyrustlm_browser_runtime_set_transcript",
    "tinyrustlm_browser_runtime_step",
    "tinyrustlm_browser_runtime_transfer_begin",
    "tinyrustlm_browser_runtime_transfer_cancel",
    "tinyrustlm_browser_runtime_transfer_commit",
    "__data_end",
    "__heap_base"
  ]);

  class BrowserRuntimeLoaderError extends Error {
    constructor(code) {
      super(code);
      this.name = "BrowserRuntimeLoaderError";
      this.code = code;
    }
  }

  function reject(code) {
    throw new BrowserRuntimeLoaderError(code);
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function requireExactObject(value, fields, code) {
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
      reject(code);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (keys.length !== fields.length ||
        fields.some((field) => !Object.hasOwn(descriptors, field)) ||
        keys.some((field) => !fields.includes(field))) {
      reject(code);
    }
    for (const field of fields) {
      const descriptor = descriptors[field];
      if (!Object.hasOwn(descriptor, "value") || descriptor.get || descriptor.set) {
        reject(code);
      }
    }
    return value;
  }

  function requireText(value, expected, code) {
    if (value !== expected) {
      reject(code);
    }
    return value;
  }

  function requireCanonicalArray(value, expected, code) {
    if (!Array.isArray(value) || value.length !== expected.length ||
        value.some((entry, index) => entry !== expected[index])) {
      reject(code);
    }
    return Object.freeze([...value]);
  }

  function normalizeManifest(value) {
    const source = requireExactObject(value, MANIFEST_FIELDS, "browser-runtime-manifest-fields");
    if (!Number.isSafeInteger(source.byteCount) || source.byteCount < 8 ||
        source.byteCount > MAXIMUM_WASM_BYTES ||
        source.maximumMemoryBytes !== MAXIMUM_MEMORY_BYTES ||
        typeof source.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(source.sha256) ||
        /^0{64}$/u.test(source.sha256)) {
      reject("browser-runtime-manifest-values");
    }
    return Object.freeze({
      schema: requireText(source.schema, MANIFEST_SCHEMA, "browser-runtime-manifest-schema"),
      profileId: requireText(source.profileId, PROFILE_ID, "browser-runtime-manifest-profile"),
      workerProtocol: requireText(
        source.workerProtocol,
        WORKER_PROTOCOL,
        "browser-runtime-manifest-worker"
      ),
      sourceCrate: requireText(
        source.sourceCrate,
        "tinyrustlm-browser-runtime-wasm",
        "browser-runtime-manifest-source"
      ),
      buildProfile: requireText(
        source.buildProfile,
        "cargo-release-wasm32-unknown-unknown-locked-offline",
        "browser-runtime-manifest-build"
      ),
      byteCount: source.byteCount,
      sha256: source.sha256,
      maximumMemoryBytes: MAXIMUM_MEMORY_BYTES,
      imports: requireCanonicalArray(source.imports, [], "browser-runtime-manifest-imports"),
      exports: requireCanonicalArray(
        source.exports,
        REQUIRED_EXPORTS,
        "browser-runtime-manifest-exports"
      ),
      requiredNextGate: requireText(
        source.requiredNextGate,
        "real-qwen3-native-wasm-parity-clean-profile-quality-and-companion-acquisition",
        "browser-runtime-manifest-next-gate"
      )
    });
  }

  function serializeManifest(value) {
    return `${JSON.stringify(normalizeManifest(value))}\n`;
  }

  function parseManifestBytes(value) {
    if (!(value instanceof Uint8Array) || value.byteLength < 2 ||
        value.byteLength > MAXIMUM_MANIFEST_BYTES) {
      reject("browser-runtime-manifest-bytes");
    }
    let text;
    let parsed;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(value);
      parsed = JSON.parse(text);
    } catch (_) {
      reject("browser-runtime-manifest-json");
    }
    const manifest = normalizeManifest(parsed);
    if (text !== serializeManifest(manifest)) {
      reject("browser-runtime-manifest-canonical");
    }
    return manifest;
  }

  function cryptoApi() {
    const value = root && root.crypto;
    if (!value || !value.subtle || typeof value.subtle.digest !== "function") {
      reject("browser-runtime-crypto");
    }
    return value;
  }

  function bytesToHex(value) {
    let output = "";
    for (const byte of value) {
      output += byte.toString(16).padStart(2, "0");
    }
    return output;
  }

  async function sha256Hex(value) {
    let digest;
    try {
      digest = await cryptoApi().subtle.digest("SHA-256", value);
    } catch (_) {
      reject("browser-runtime-sha256");
    }
    return bytesToHex(new Uint8Array(digest));
  }

  // Read decoded bytes into one bounded buffer; declared wire size is not a decoded bound.
  async function fetchBytes(fetchFunction, url, maximumBytes, code) {
    let response;
    let reader;
    let bytes;
    let complete = false;
    try {
      response = await fetchFunction(url, { cache: "no-store", credentials: "omit" });
      if (!response || response.ok !== true || !response.body ||
          typeof response.body.getReader !== "function") {
        reject(code);
      }
      const headers = response.headers;
      const contentLength = headers && typeof headers.get === "function"
        ? headers.get("content-length") : null;
      const contentEncoding = headers && typeof headers.get === "function"
        ? headers.get("content-encoding") : null;
      const encoded = Boolean(contentEncoding && contentEncoding.trim().toLowerCase() !== "identity");
      if (contentLength !== null && contentLength !== "" &&
          (!/^(?:0|[1-9][0-9]*)$/u.test(contentLength) ||
            !Number.isSafeInteger(Number(contentLength)) ||
            (!encoded && Number(contentLength) > maximumBytes))) {
        reject(code);
      }
      reader = response.body.getReader();
      bytes = new Uint8Array(maximumBytes);
      let offset = 0;
      while (true) {
        const item = await reader.read();
        if (!item || typeof item.done !== "boolean") reject(code);
        if (item.done) break;
        if (!(item.value instanceof Uint8Array) || item.value.byteLength < 1 ||
            item.value.byteLength > maximumBytes - offset) {
          reject(code);
        }
        bytes.set(item.value, offset);
        offset += item.value.byteLength;
      }
      if (offset === 0) reject(code);
      const result = offset === bytes.byteLength ? bytes : bytes.slice(0, offset);
      complete = true;
      return result;
    } catch (_) {
      reject(code);
    } finally {
      if (!complete) {
        if (bytes) bytes.fill(0);
        try {
          const source = reader || (response && response.body);
          if (source && typeof source.cancel === "function") {
            // A failed stream must not keep fetching or make cleanup wait forever.
            Promise.resolve(source.cancel()).catch(() => {});
          }
        } catch (_) { /* Cleanup preserves the original typed fetch failure. */ }
      }
      try {
        if (reader && typeof reader.releaseLock === "function") reader.releaseLock();
      } catch (_) { /* A cleanup failure cannot replace the transfer verdict. */ }
    }
  }

  // Bind streamed runtime bytes to the canonical manifest before returning them to the worker.
  async function load(options) {
    const source = requireExactObject(
      options,
      ["manifestUrl", "wasmUrl", "fetchFunction"],
      "browser-runtime-loader-options"
    );
    if (typeof source.manifestUrl !== "string" || !source.manifestUrl ||
        typeof source.wasmUrl !== "string" || !source.wasmUrl ||
        typeof source.fetchFunction !== "function") {
      reject("browser-runtime-loader-options");
    }
    const manifestBytes = await fetchBytes(
      source.fetchFunction,
      source.manifestUrl,
      MAXIMUM_MANIFEST_BYTES,
      "browser-runtime-manifest-fetch"
    );
    let manifest;
    try {
      manifest = parseManifestBytes(manifestBytes);
    } finally {
      manifestBytes.fill(0);
    }
    const wasm = await fetchBytes(
      source.fetchFunction,
      source.wasmUrl,
      manifest.byteCount,
      "browser-runtime-wasm-fetch"
    );
    try {
      if (wasm.byteLength !== manifest.byteCount ||
          await sha256Hex(wasm) !== manifest.sha256 ||
          !root.WebAssembly || typeof root.WebAssembly.validate !== "function" ||
          !root.WebAssembly.validate(wasm)) {
        reject("browser-runtime-wasm-identity");
      }
      return Object.freeze({ manifest, wasmBytes: wasm.buffer });
    } catch (error) {
      wasm.fill(0);
      throw error;
    }
  }

  return Object.freeze({
    manifestSchema: MANIFEST_SCHEMA,
    profileId: PROFILE_ID,
    workerProtocol: WORKER_PROTOCOL,
    maximumManifestBytes: MAXIMUM_MANIFEST_BYTES,
    maximumWasmBytes: MAXIMUM_WASM_BYTES,
    maximumMemoryBytes: MAXIMUM_MEMORY_BYTES,
    requiredExports: REQUIRED_EXPORTS,
    BrowserRuntimeLoaderError,
    normalizeManifest,
    serializeManifest,
    parseManifestBytes,
    load
  });
}));
