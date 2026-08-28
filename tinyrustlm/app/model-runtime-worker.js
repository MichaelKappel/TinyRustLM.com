(function (root, factory) {
  "use strict";

  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (api.isDedicatedWorkerScope(root)) {
    api.attachDedicatedWorker(root);
  }
}(typeof globalThis === "object" ? globalThis : this, function (root) {
  "use strict";

  const PROTOCOL_SCHEMA = "tinyrustlm.model-runtime-worker/1";
  const EVENT_ID_DOMAIN = "tinyrustlm.model-runtime-worker.event/1";
  const MAXIMUM_MESSAGES = 65536;
  const MAXIMUM_BINARY_CHUNK_BYTES = 4 * 1024 * 1024;
  const MAXIMUM_WASM_BYTES = 16 * 1024 * 1024;
  const MAXIMUM_WASM_MEMORY_BYTES = 3 * 1024 * 1024 * 1024;
  const MAXIMUM_RESULT_BYTES = 16 * 1024 * 1024;
  const STATUS_BOUNDARY_REJECTED = 1;
  const STATUS_RUNTIME_REJECTED = 2;
  const STATUS_INTERNAL_FAILURE = 3;
  const ID_PATTERN = /^[0-9a-f]{64}$/u;
  const ERROR_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,159}$/u;

  const MESSAGE_FIELDS = Object.freeze([
    "schema",
    "workerId",
    "operationId",
    "compositionId",
    "conversationId",
    "turnId",
    "generationId",
    "messageId",
    "sequence",
    "kind",
    "payload"
  ]);

  const COMMAND_PAYLOAD_FIELDS = Object.freeze({
    "initialize": Object.freeze([
      "wasmBytes",
      "wasmSha256",
      "maximumModelBytes",
      "maximumSequenceTokens",
      "maximumKvBytes",
      "maximumScratchBytes",
      "maximumResolvedMemberBytes",
      "maximumResidentDependencyBytes",
      "maximumRequestBytes",
      "maximumLinearMemoryBytes",
      "transcriptRevisionLow",
      "transcriptRevisionHigh"
    ]),
    "artifact-begin": Object.freeze(["artifactKind", "byteLength"]),
    "artifact-chunk": Object.freeze(["artifactKind", "offset", "bytes"]),
    "artifact-commit": Object.freeze(["artifactKind"]),
    "activate": Object.freeze([]),
    "advance-operation": Object.freeze(["nextOperationId", "nextCompositionId"]),
    "set-transcript": Object.freeze(["revisionLow", "revisionHigh"]),
    "begin-generation": Object.freeze([]),
    "step-generation": Object.freeze([]),
    "cancel-generation": Object.freeze([]),
    "release": Object.freeze([])
  });

  const EVENT_PAYLOAD_FIELDS = Object.freeze({
    "runtime-ready": Object.freeze(["commandMessageId", "state"]),
    "artifact-transfer-begun": Object.freeze([
      "commandMessageId", "artifactKind", "byteLength"
    ]),
    "artifact-chunk-accepted": Object.freeze([
      "commandMessageId", "artifactKind", "offset", "byteLength", "nextOffset"
    ]),
    "artifact-transfer-committed": Object.freeze([
      "commandMessageId", "artifactKind", "byteLength"
    ]),
    "composition-active": Object.freeze(["commandMessageId", "state"]),
    "operation-advanced": Object.freeze([
      "commandMessageId", "state", "pendingCompositionId"
    ]),
    "transcript-updated": Object.freeze(["commandMessageId", "state"]),
    "generation-begun": Object.freeze(["commandMessageId", "state"]),
    "generation-step": Object.freeze(["commandMessageId", "step"]),
    "generation-complete": Object.freeze(["commandMessageId", "output"]),
    "runtime-released": Object.freeze(["commandMessageId"]),
    "command-rejected": Object.freeze([
      "commandMessageId", "status", "code", "workerTerminated"
    ])
  });

  const ARTIFACT_KINDS = Object.freeze({
    "model": Object.freeze({ code: 3, maximum: "maximumModelBytes" }),
    "tokenizer": Object.freeze({ code: 4, exactMaximum: 64 * 1024 * 1024 }),
    "template": Object.freeze({ code: 5, exactMaximum: 1024 * 1024 }),
    "sampling": Object.freeze({ code: 6, exact: 65800 }),
    "prompt": Object.freeze({ code: 7, exact: 512 }),
    "composition": Object.freeze({ code: 8, exact: 896 }),
    "prompt-request": Object.freeze({ code: 9, maximum: "maximumRequestBytes" })
  });

  const ACTIVATION_ARTIFACTS = Object.freeze([
    "model", "tokenizer", "template", "sampling", "prompt", "composition"
  ]);

  const NETWORK_GLOBALS = Object.freeze([
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "WebTransport",
    "RTCPeerConnection",
    "importScripts"
  ]);

  const FUNCTION_EXPORTS = Object.freeze([
    "tinyrustlm_browser_runtime_abi_version",
    "tinyrustlm_browser_runtime_transfer_begin",
    "tinyrustlm_browser_runtime_transfer_commit",
    "tinyrustlm_browser_runtime_transfer_cancel",
    "tinyrustlm_browser_runtime_create",
    "tinyrustlm_browser_runtime_activate",
    "tinyrustlm_browser_runtime_advance_operation",
    "tinyrustlm_browser_runtime_set_transcript",
    "tinyrustlm_browser_runtime_begin_request",
    "tinyrustlm_browser_runtime_step",
    "tinyrustlm_browser_runtime_finish",
    "tinyrustlm_browser_runtime_release",
    "tinyrustlm_browser_runtime_result_ptr",
    "tinyrustlm_browser_runtime_result_len",
    "tinyrustlm_browser_runtime_error_ptr",
    "tinyrustlm_browser_runtime_error_len"
  ]);

  const MODULE_EXPORTS = Object.freeze([
    ...FUNCTION_EXPORTS.map((name) => Object.freeze({ name, kind: "function" })),
    Object.freeze({ name: "__data_end", kind: "global" }),
    Object.freeze({ name: "__heap_base", kind: "global" }),
    Object.freeze({ name: "memory", kind: "memory" })
  ]);

  class WorkerProtocolError extends Error {
    constructor(code) {
      super(code);
      this.name = "WorkerProtocolError";
      this.code = code;
      this.terminate = true;
    }
  }

  class CommandRejection extends Error {
    constructor(status, code, terminate) {
      super(code);
      this.name = "CommandRejection";
      this.status = status;
      this.code = code;
      this.terminate = terminate === true;
    }
  }

  function protocolError(code) {
    throw new WorkerProtocolError(code);
  }

  function commandRejection(status, code, terminate) {
    throw new CommandRejection(status, code, terminate);
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function requireExactObject(value, fields, code) {
    if (!isPlainObject(value)) protocolError(code);
    if (Object.getOwnPropertySymbols(value).length !== 0) protocolError(code);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (keys.length !== fields.length) protocolError(code);
    const expected = new Set(fields);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!expected.has(key) || !descriptor.enumerable || !("value" in descriptor)) {
        protocolError(code);
      }
    }
    return value;
  }

  function requireId(value, code) {
    if (typeof value !== "string" || !ID_PATTERN.test(value)) protocolError(code);
    return value;
  }

  function requireNonzeroId(value, code) {
    requireId(value, code);
    if (/^0{64}$/u.test(value)) protocolError(code);
    return value;
  }

  function requireUnsigned32(value, code, allowZero) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) protocolError(code);
    if (!allowZero && value === 0) protocolError(code);
    return value;
  }

  function requireArrayBuffer(value, minimum, maximum, code) {
    if (!(value instanceof ArrayBuffer)) protocolError(code);
    const length = value.byteLength;
    if (length < minimum || length > maximum) protocolError(code);
    return value;
  }

  function requireArtifactKind(value) {
    if (typeof value !== "string" || !Object.hasOwn(ARTIFACT_KINDS, value)) {
      protocolError("model-runtime-worker-artifact-kind");
    }
    return value;
  }

  function stableCode(value, fallback) {
    return typeof value === "string" && ERROR_CODE_PATTERN.test(value) ? value : fallback;
  }

  function hexLower(bytes) {
    let output = "";
    for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
    return output;
  }

  function bytesFromHex(value) {
    const bytes = new Uint8Array(32);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(value.slice(index * 2, (index * 2) + 2), 16);
    }
    return bytes;
  }

  function textEncoder() {
    if (typeof root.TextEncoder !== "function") {
      commandRejection(STATUS_INTERNAL_FAILURE, "model-runtime-worker-text-encoder", true);
    }
    return new root.TextEncoder();
  }

  function textDecoder() {
    if (typeof root.TextDecoder !== "function") {
      commandRejection(STATUS_INTERNAL_FAILURE, "model-runtime-worker-text-decoder", true);
    }
    return new root.TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  }

  async function sha256Hex(bytes) {
    if (!root.crypto || !root.crypto.subtle ||
        typeof root.crypto.subtle.digest !== "function") {
      commandRejection(STATUS_INTERNAL_FAILURE, "model-runtime-worker-web-crypto", true);
    }
    let digest;
    try {
      digest = await root.crypto.subtle.digest("SHA-256", bytes);
    } catch (_) {
      commandRejection(STATUS_INTERNAL_FAILURE, "model-runtime-worker-sha256", true);
    }
    return hexLower(new Uint8Array(digest));
  }

  async function deriveEventMessageId(value) {
    requireExactObject(value, ["workerId", "commandMessageId", "sequence", "kind"],
      "model-runtime-worker-event-id-input");
    requireId(value.workerId, "model-runtime-worker-event-worker-id");
    requireId(value.commandMessageId, "model-runtime-worker-event-command-id");
    requireUnsigned32(value.sequence, "model-runtime-worker-event-sequence", true);
    if (!Object.hasOwn(EVENT_PAYLOAD_FIELDS, value.kind)) {
      protocolError("model-runtime-worker-event-kind");
    }
    const canonical = [
      EVENT_ID_DOMAIN,
      value.workerId,
      value.commandMessageId,
      String(value.sequence),
      value.kind
    ].join("\n");
    return sha256Hex(textEncoder().encode(canonical));
  }

  function readUnsignedLeb128(bytes, cursor) {
    let result = 0n;
    let shift = 0n;
    for (let count = 0; count < 10; count += 1) {
      if (cursor.offset >= bytes.length) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-wasm-truncated", true);
      }
      const byte = BigInt(bytes[cursor.offset]);
      cursor.offset += 1;
      result |= (byte & 0x7fn) << shift;
      if ((byte & 0x80n) === 0n) return result;
      shift += 7n;
    }
    commandRejection(STATUS_BOUNDARY_REJECTED,
      "model-runtime-worker-wasm-leb128", true);
  }

  function inspectWasmMemory(bytes) {
    if (hexLower(bytes.subarray(0, 8)) !== "0061736d01000000") {
      commandRejection(STATUS_BOUNDARY_REJECTED,
        "model-runtime-worker-wasm-magic", true);
    }
    const cursor = { offset: 8 };
    let memory = null;
    while (cursor.offset < bytes.length) {
      const sectionId = bytes[cursor.offset];
      cursor.offset += 1;
      const sectionBytes = Number(readUnsignedLeb128(bytes, cursor));
      const sectionEnd = cursor.offset + sectionBytes;
      if (!Number.isSafeInteger(sectionBytes) || sectionEnd > bytes.length) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-wasm-section", true);
      }
      if (sectionId !== 5) {
        cursor.offset = sectionEnd;
        continue;
      }
      if (memory !== null || readUnsignedLeb128(bytes, cursor) !== 1n) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-wasm-memory-count", true);
      }
      const flags = readUnsignedLeb128(bytes, cursor);
      if (flags !== 1n) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-wasm-memory-flags", true);
      }
      const minimumPages = readUnsignedLeb128(bytes, cursor);
      const maximumPages = readUnsignedLeb128(bytes, cursor);
      if (cursor.offset !== sectionEnd || minimumPages > maximumPages) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-wasm-memory-section", true);
      }
      memory = { minimumPages, maximumPages };
    }
    if (memory === null || memory.maximumPages * 65536n !== BigInt(MAXIMUM_WASM_MEMORY_BYTES)) {
      commandRejection(STATUS_BOUNDARY_REJECTED,
        "model-runtime-worker-wasm-memory-maximum", true);
    }
    return memory;
  }

  function sortedModuleEntries(entries) {
    return entries.map((entry) => ({ name: entry.name, kind: entry.kind }))
      .sort((left, right) => {
        const names = left.name.localeCompare(right.name);
        return names === 0 ? left.kind.localeCompare(right.kind) : names;
      });
  }

  function requireExactModuleShape(module) {
    const imports = WebAssembly.Module.imports(module);
    if (imports.length !== 0) {
      commandRejection(STATUS_BOUNDARY_REJECTED,
        "model-runtime-worker-wasm-imports", true);
    }
    const actual = sortedModuleEntries(WebAssembly.Module.exports(module));
    const expected = sortedModuleEntries(MODULE_EXPORTS);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      commandRejection(STATUS_BOUNDARY_REJECTED,
        "model-runtime-worker-wasm-exports", true);
    }
  }

  function requireRuntimeExports(exports) {
    if (exports === null || typeof exports !== "object") {
      commandRejection(STATUS_BOUNDARY_REJECTED,
        "model-runtime-worker-wasm-instance", true);
    }
    const actual = Object.keys(exports).sort();
    const expected = MODULE_EXPORTS.map((entry) => entry.name).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      commandRejection(STATUS_BOUNDARY_REJECTED,
        "model-runtime-worker-wasm-instance-exports", true);
    }
    for (const name of FUNCTION_EXPORTS) {
      if (typeof exports[name] !== "function") {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-wasm-function", true);
      }
    }
    if (!exports.memory || !(exports.memory.buffer instanceof ArrayBuffer)) {
      commandRejection(STATUS_BOUNDARY_REJECTED,
        "model-runtime-worker-wasm-memory", true);
    }
    if ((exports.tinyrustlm_browser_runtime_abi_version() >>> 0) !== 1) {
      commandRejection(STATUS_BOUNDARY_REJECTED,
        "model-runtime-worker-wasm-version", true);
    }
    return exports;
  }

  async function loadWasm(bytes, expectedSha256) {
    const view = new Uint8Array(bytes);
    const actualSha256 = await sha256Hex(view);
    if (actualSha256 !== expectedSha256) {
      commandRejection(STATUS_BOUNDARY_REJECTED,
        "model-runtime-worker-wasm-sha256", true);
    }
    inspectWasmMemory(view);
    let instantiated;
    try {
      instantiated = await WebAssembly.instantiate(bytes, {});
    } catch (_) {
      commandRejection(STATUS_BOUNDARY_REJECTED,
        "model-runtime-worker-wasm-instantiate", true);
    }
    requireExactModuleShape(instantiated.module);
    return { exports: requireRuntimeExports(instantiated.instance.exports) };
  }

  function requirePolicy(payload) {
    const policy = {
      maximumModelBytes: requireUnsigned32(payload.maximumModelBytes,
        "model-runtime-worker-maximum-model-bytes", false),
      maximumSequenceTokens: requireUnsigned32(payload.maximumSequenceTokens,
        "model-runtime-worker-maximum-sequence-tokens", false),
      maximumKvBytes: requireUnsigned32(payload.maximumKvBytes,
        "model-runtime-worker-maximum-kv-bytes", false),
      maximumScratchBytes: requireUnsigned32(payload.maximumScratchBytes,
        "model-runtime-worker-maximum-scratch-bytes", false),
      maximumResolvedMemberBytes: requireUnsigned32(payload.maximumResolvedMemberBytes,
        "model-runtime-worker-maximum-resolved-member-bytes", false),
      maximumResidentDependencyBytes: requireUnsigned32(
        payload.maximumResidentDependencyBytes,
        "model-runtime-worker-maximum-resident-dependency-bytes", false),
      maximumRequestBytes: requireUnsigned32(payload.maximumRequestBytes,
        "model-runtime-worker-maximum-request-bytes", false),
      maximumLinearMemoryBytes: requireUnsigned32(payload.maximumLinearMemoryBytes,
        "model-runtime-worker-maximum-linear-memory-bytes", false)
    };
    const ceilings = {
      maximumModelBytes: 0x80000000,
      maximumSequenceTokens: 40960,
      maximumKvBytes: 0x80000000,
      maximumScratchBytes: 0x40000000,
      maximumResolvedMemberBytes: 2281701376,
      maximumResidentDependencyBytes: 128 * 1024 * 1024,
      maximumRequestBytes: 16 * 1024 * 1024,
      maximumLinearMemoryBytes: MAXIMUM_WASM_MEMORY_BYTES
    };
    for (const [key, ceiling] of Object.entries(ceilings)) {
      if (policy[key] > ceiling) protocolError("model-runtime-worker-policy");
    }
    const peak = (2 * policy.maximumModelBytes) + policy.maximumKvBytes +
      policy.maximumScratchBytes + policy.maximumResidentDependencyBytes +
      policy.maximumRequestBytes;
    const resolved = policy.maximumModelBytes + policy.maximumResidentDependencyBytes;
    if (peak > policy.maximumLinearMemoryBytes ||
        resolved > policy.maximumResolvedMemberBytes) {
      protocolError("model-runtime-worker-policy");
    }
    return Object.freeze(policy);
  }

  function validatePayload(kind, payload) {
    const fields = COMMAND_PAYLOAD_FIELDS[kind];
    requireExactObject(payload, fields, "model-runtime-worker-payload-fields");
    switch (kind) {
      case "initialize":
        requireArrayBuffer(payload.wasmBytes, 1, MAXIMUM_WASM_BYTES,
          "model-runtime-worker-wasm-bytes");
        requireId(payload.wasmSha256, "model-runtime-worker-wasm-sha256-field");
        requirePolicy(payload);
        requireUnsigned32(payload.transcriptRevisionLow,
          "model-runtime-worker-transcript-revision-low", true);
        requireUnsigned32(payload.transcriptRevisionHigh,
          "model-runtime-worker-transcript-revision-high", true);
        break;
      case "artifact-begin":
        requireArtifactKind(payload.artifactKind);
        requireUnsigned32(payload.byteLength,
          "model-runtime-worker-artifact-byte-length", false);
        break;
      case "artifact-chunk":
        requireArtifactKind(payload.artifactKind);
        requireUnsigned32(payload.offset, "model-runtime-worker-artifact-offset", true);
        requireArrayBuffer(payload.bytes, 1, MAXIMUM_BINARY_CHUNK_BYTES,
          "model-runtime-worker-artifact-chunk");
        break;
      case "artifact-commit":
        requireArtifactKind(payload.artifactKind);
        break;
      case "advance-operation":
        requireNonzeroId(payload.nextOperationId,
          "model-runtime-worker-next-operation-id");
        requireId(payload.nextCompositionId,
          "model-runtime-worker-next-composition-id");
        break;
      case "set-transcript":
        requireUnsigned32(payload.revisionLow,
          "model-runtime-worker-transcript-revision-low", true);
        requireUnsigned32(payload.revisionHigh,
          "model-runtime-worker-transcript-revision-high", true);
        break;
      default:
        break;
    }
  }

  function requireSafeNonnegative(value, code) {
    if (!Number.isSafeInteger(value) || value < 0) {
      commandRejection(STATUS_INTERNAL_FAILURE, code, true);
    }
    return value;
  }

  function requireResultObject(value, fields, code) {
    if (!isPlainObject(value)) commandRejection(STATUS_INTERNAL_FAILURE, code, true);
    const keys = Object.keys(value);
    if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
      commandRejection(STATUS_INTERNAL_FAILURE, code, true);
    }
    return value;
  }

  function validateGenerationStatus(value) {
    requireResultObject(value, ["kind", "stopTokenId"],
      "model-runtime-worker-result-generation-status");
    const kinds = new Set([
      "active", "stop-token", "maximum-new-tokens", "context-limit", "cancelled"
    ]);
    if (!kinds.has(value.kind)) {
      commandRejection(STATUS_INTERNAL_FAILURE,
        "model-runtime-worker-result-generation-status", true);
    }
    if (value.kind === "stop-token") {
      requireUnsigned32Result(value.stopTokenId,
        "model-runtime-worker-result-stop-token");
    } else if (value.stopTokenId !== null) {
      commandRejection(STATUS_INTERNAL_FAILURE,
        "model-runtime-worker-result-stop-token", true);
    }
    return value;
  }

  function requireUnsigned32Result(value, code) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
      commandRejection(STATUS_INTERNAL_FAILURE, code, true);
    }
    return value;
  }

  function validateIdentity(value) {
    requireResultObject(value, [
      "artifactBytes", "artifactSha256", "graphIdentitySha256", "memberTableSha256"
    ], "model-runtime-worker-result-composition");
    requireSafeNonnegative(value.artifactBytes,
      "model-runtime-worker-result-artifact-bytes");
    for (const key of ["artifactSha256", "graphIdentitySha256", "memberTableSha256"]) {
      if (typeof value[key] !== "string" || !ID_PATTERN.test(value[key])) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-result-composition", true);
      }
    }
    return value;
  }

  function validateMemoryPlan(value) {
    requireResultObject(value, ["modelBytes", "kvBytes", "scratchBytes"],
      "model-runtime-worker-result-memory-plan");
    for (const key of ["modelBytes", "kvBytes", "scratchBytes"]) {
      requireSafeNonnegative(value[key], "model-runtime-worker-result-memory-plan");
    }
    return value;
  }

  function validateState(value) {
    requireResultObject(value, [
      "schema",
      "state",
      "operationId",
      "transcriptRevisionLow",
      "transcriptRevisionHigh",
      "activeComposition",
      "committedKvBytes",
      "memoryPlan",
      "observedLinearMemoryBytes",
      "maximumLinearMemoryBytes"
    ], "model-runtime-worker-result-state");
    if (value.schema !== "tinyrustlm.browser_runtime_wasm.state/1" ||
        !new Set(["empty", "active-idle", "generating", "terminal-output-ready"])
          .has(value.state) || !ID_PATTERN.test(value.operationId)) {
      commandRejection(STATUS_INTERNAL_FAILURE,
        "model-runtime-worker-result-state", true);
    }
    requireUnsigned32Result(value.transcriptRevisionLow,
      "model-runtime-worker-result-transcript-revision");
    requireUnsigned32Result(value.transcriptRevisionHigh,
      "model-runtime-worker-result-transcript-revision");
    requireSafeNonnegative(value.committedKvBytes,
      "model-runtime-worker-result-committed-kv");
    requireSafeNonnegative(value.observedLinearMemoryBytes,
      "model-runtime-worker-result-linear-memory");
    requireUnsigned32Result(value.maximumLinearMemoryBytes,
      "model-runtime-worker-result-linear-memory");
    if (value.activeComposition !== null) validateIdentity(value.activeComposition);
    if (value.memoryPlan !== null) validateMemoryPlan(value.memoryPlan);
    return value;
  }

  function validateStep(value) {
    requireResultObject(value, [
      "schema", "selectedTokenId", "emittedTokenId", "status", "committedKvBytes"
    ], "model-runtime-worker-result-step");
    if (value.schema !== "tinyrustlm.browser_runtime_wasm.step/1") {
      commandRejection(STATUS_INTERNAL_FAILURE,
        "model-runtime-worker-result-step", true);
    }
    for (const key of ["selectedTokenId", "emittedTokenId"]) {
      if (value[key] !== null) {
        requireUnsigned32Result(value[key], "model-runtime-worker-result-token-id");
      }
    }
    validateGenerationStatus(value.status);
    requireSafeNonnegative(value.committedKvBytes,
      "model-runtime-worker-result-committed-kv");
    return value;
  }

  function validateOutput(value, maximumSequenceTokens) {
    requireResultObject(value, [
      "schema", "text", "tokenIds", "status", "composition", "operationId",
      "committedKvBytes"
    ], "model-runtime-worker-result-output");
    if (value.schema !== "tinyrustlm.browser_runtime_wasm.output/1" ||
        typeof value.text !== "string" || !Array.isArray(value.tokenIds) ||
        value.tokenIds.length > maximumSequenceTokens ||
        typeof value.operationId !== "string" || !ID_PATTERN.test(value.operationId)) {
      commandRejection(STATUS_INTERNAL_FAILURE,
        "model-runtime-worker-result-output", true);
    }
    for (const tokenId of value.tokenIds) {
      requireUnsigned32Result(tokenId, "model-runtime-worker-result-token-id");
    }
    validateGenerationStatus(value.status);
    validateIdentity(value.composition);
    requireSafeNonnegative(value.committedKvBytes,
      "model-runtime-worker-result-committed-kv");
    return value;
  }

  class ModelRuntimeWorker {
    constructor(options) {
      const source = options && typeof options === "object" ? options : {};
      this.loadWasm = typeof source.loadWasm === "function" ? source.loadWasm : loadWasm;
      this.exports = null;
      this.policy = null;
      this.workerId = null;
      this.currentOperationId = null;
      this.activeCompositionId = null;
      this.pendingCompositionId = null;
      this.expectedCommandSequence = 0;
      this.nextEventSequence = 0;
      this.seenMessageIds = new Set();
      this.committedArtifacts = new Set();
      this.pendingArtifact = null;
      this.activeGeneration = null;
      this.completedGenerationIds = new Set();
      this.initialized = false;
      this.terminated = false;
      this.tail = Promise.resolve();
    }

    enqueue(message) {
      const operation = this.tail.then(() => this.process(message));
      this.tail = operation.catch(() => undefined);
      return operation;
    }

    async process(input) {
      let command;
      try {
        command = this.acceptCommand(input);
      } catch (error) {
        if (error instanceof WorkerProtocolError) {
          this.invalidate();
        }
        throw error;
      }

      try {
        return await this.dispatch(command);
      } catch (error) {
        if (error instanceof WorkerProtocolError) {
          this.invalidate();
          throw error;
        }
        const rejection = error instanceof CommandRejection
          ? error
          : new CommandRejection(
            STATUS_INTERNAL_FAILURE,
            "model-runtime-worker-internal",
            true
          );
        if (command.kind === "initialize") rejection.terminate = true;
        if (rejection.terminate) this.invalidate();
        return this.rejectionResult(command, rejection);
      }
    }

    acceptCommand(input) {
      if (this.terminated) protocolError("model-runtime-worker-released");
      const command = requireExactObject(input, MESSAGE_FIELDS,
        "model-runtime-worker-command-fields");
      if (command.schema !== PROTOCOL_SCHEMA) {
        protocolError("model-runtime-worker-schema");
      }
      if (!Object.hasOwn(COMMAND_PAYLOAD_FIELDS, command.kind)) {
        protocolError("model-runtime-worker-command-kind");
      }
      requireId(command.workerId, "model-runtime-worker-worker-id");
      requireNonzeroId(command.operationId, "model-runtime-worker-operation-id");
      requireId(command.compositionId, "model-runtime-worker-composition-id");
      requireId(command.conversationId, "model-runtime-worker-conversation-id");
      requireId(command.turnId, "model-runtime-worker-turn-id");
      requireId(command.generationId, "model-runtime-worker-generation-id");
      requireId(command.messageId, "model-runtime-worker-message-id");
      requireUnsigned32(command.sequence, "model-runtime-worker-command-sequence", true);
      if (command.sequence >= MAXIMUM_MESSAGES ||
          command.sequence !== this.expectedCommandSequence) {
        protocolError("model-runtime-worker-command-sequence");
      }
      if (this.seenMessageIds.has(command.messageId)) {
        protocolError("model-runtime-worker-duplicate-message");
      }
      if (!this.initialized && command.kind !== "initialize") {
        protocolError("model-runtime-worker-initialize-required");
      }
      if (this.initialized) {
        if (command.workerId !== this.workerId) {
          protocolError("model-runtime-worker-stale-worker");
        }
        if (command.operationId !== this.currentOperationId) {
          protocolError("model-runtime-worker-stale-operation");
        }
      }
      validatePayload(command.kind, command.payload);
      this.seenMessageIds.add(command.messageId);
      this.expectedCommandSequence += 1;
      return command;
    }

    async dispatch(command) {
      switch (command.kind) {
        case "initialize": return this.initialize(command);
        case "artifact-begin": return this.artifactBegin(command);
        case "artifact-chunk": return this.artifactChunk(command);
        case "artifact-commit": return this.artifactCommit(command);
        case "activate": return this.activate(command);
        case "advance-operation": return this.advanceOperation(command);
        case "set-transcript": return this.setTranscript(command);
        case "begin-generation": return this.beginGeneration(command);
        case "step-generation": return this.stepGeneration(command, false);
        case "cancel-generation": return this.stepGeneration(command, true);
        case "release": return this.release(command);
        default: protocolError("model-runtime-worker-command-kind");
      }
    }

    async initialize(command) {
      if (this.initialized || this.exports !== null) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-already-initialized", false);
      }
      const payload = command.payload;
      this.workerId = command.workerId;
      this.currentOperationId = command.operationId;
      this.pendingCompositionId = command.compositionId;
      this.policy = requirePolicy(payload);
      let loaded;
      try {
        loaded = await this.loadWasm(payload.wasmBytes, payload.wasmSha256);
      } finally {
        new Uint8Array(payload.wasmBytes).fill(0);
      }
      this.exports = requireRuntimeExports(loaded && loaded.exports);
      this.stageOperation(1, command.operationId);
      const state = this.callResult("tinyrustlm_browser_runtime_create", [
        this.policy.maximumModelBytes,
        this.policy.maximumSequenceTokens,
        this.policy.maximumKvBytes,
        this.policy.maximumScratchBytes,
        this.policy.maximumResolvedMemberBytes,
        this.policy.maximumResidentDependencyBytes,
        this.policy.maximumRequestBytes,
        this.policy.maximumLinearMemoryBytes,
        payload.transcriptRevisionLow,
        payload.transcriptRevisionHigh
      ], validateState);
      if (state.state !== "empty" || state.operationId !== command.operationId ||
          state.activeComposition !== null || state.memoryPlan !== null ||
          state.transcriptRevisionLow !== payload.transcriptRevisionLow ||
          state.transcriptRevisionHigh !== payload.transcriptRevisionHigh) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-create-state", true);
      }
      this.requireStatePolicy(state);
      this.initialized = true;
      return this.eventResult(command, "runtime-ready", {
        commandMessageId: command.messageId,
        state
      }, false);
    }

    artifactBegin(command) {
      this.requireNoGeneration();
      if (this.pendingArtifact !== null) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-transfer-active", false);
      }
      const kind = command.payload.artifactKind;
      this.requireArtifactComposition(command, kind);
      this.requireArtifactLength(kind, command.payload.byteLength);
      const definition = ARTIFACT_KINDS[kind];
      const pointer = this.exports.tinyrustlm_browser_runtime_transfer_begin(
        definition.code,
        command.payload.byteLength
      ) >>> 0;
      if (pointer === 0) this.throwPointerFailure();
      const end = pointer + command.payload.byteLength;
      this.pendingArtifact = {
        kind,
        code: definition.code,
        pointer,
        byteLength: command.payload.byteLength,
        nextOffset: 0,
        compositionId: command.compositionId
      };
      if (!Number.isSafeInteger(end) || end > this.exports.memory.buffer.byteLength) {
        this.cancelPendingRawTransfer();
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-transfer-memory", true);
      }
      return this.eventResult(command, "artifact-transfer-begun", {
        commandMessageId: command.messageId,
        artifactKind: kind,
        byteLength: command.payload.byteLength
      }, false);
    }

    artifactChunk(command) {
      const payload = command.payload;
      const chunk = new Uint8Array(payload.bytes);
      try {
        const pending = this.pendingArtifact;
        if (pending === null || pending.kind !== payload.artifactKind ||
            pending.compositionId !== command.compositionId) {
          this.cancelPendingRawTransfer();
          commandRejection(STATUS_BOUNDARY_REJECTED,
            "model-runtime-worker-chunk-transfer", false);
        }
        if (payload.offset !== pending.nextOffset) {
          this.cancelPendingRawTransfer();
          commandRejection(STATUS_BOUNDARY_REJECTED,
            "model-runtime-worker-chunk-offset", false);
        }
        const nextOffset = pending.nextOffset + chunk.byteLength;
        if (nextOffset > pending.byteLength) {
          this.cancelPendingRawTransfer();
          commandRejection(STATUS_BOUNDARY_REJECTED,
            "model-runtime-worker-chunk-length", false);
        }
        const target = new Uint8Array(
          this.exports.memory.buffer,
          pending.pointer + pending.nextOffset,
          chunk.byteLength
        );
        target.set(chunk);
        const acceptedOffset = pending.nextOffset;
        pending.nextOffset = nextOffset;
        return this.eventResult(command, "artifact-chunk-accepted", {
          commandMessageId: command.messageId,
          artifactKind: pending.kind,
          offset: acceptedOffset,
          byteLength: chunk.byteLength,
          nextOffset
        }, false);
      } finally {
        chunk.fill(0);
      }
    }

    artifactCommit(command) {
      const pending = this.pendingArtifact;
      if (pending === null || pending.kind !== command.payload.artifactKind ||
          pending.compositionId !== command.compositionId) {
        this.cancelPendingRawTransfer();
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-commit-transfer", false);
      }
      if (pending.nextOffset !== pending.byteLength) {
        this.cancelPendingRawTransfer();
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-commit-length", false);
      }
      this.pendingArtifact = null;
      const status = this.exports.tinyrustlm_browser_runtime_transfer_commit(
        pending.code,
        pending.pointer,
        pending.byteLength
      ) >>> 0;
      if (status !== 0) this.throwAbiFailure(status);
      this.committedArtifacts.add(pending.kind);
      return this.eventResult(command, "artifact-transfer-committed", {
        commandMessageId: command.messageId,
        artifactKind: pending.kind,
        byteLength: pending.byteLength
      }, false);
    }

    activate(command) {
      this.requireNoGeneration();
      if (this.pendingCompositionId === null ||
          command.compositionId !== this.pendingCompositionId) {
        protocolError("model-runtime-worker-stale-composition");
      }
      if (this.pendingArtifact !== null ||
          ACTIVATION_ARTIFACTS.some((kind) => !this.committedArtifacts.has(kind))) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-composition-required", false);
      }
      this.stageOperation(1, command.operationId);
      for (const kind of ACTIVATION_ARTIFACTS) this.committedArtifacts.delete(kind);
      const state = this.callResult(
        "tinyrustlm_browser_runtime_activate",
        [],
        validateState
      );
      const identity = state.activeComposition;
      if (state.state !== "active-idle" || state.operationId !== command.operationId ||
          identity === null ||
          identity.graphIdentitySha256 !== this.pendingCompositionId) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-activation-identity", true);
      }
      this.requireStatePolicy(state);
      this.activeCompositionId = this.pendingCompositionId;
      this.pendingCompositionId = null;
      return this.eventResult(command, "composition-active", {
        commandMessageId: command.messageId,
        state
      }, false);
    }

    advanceOperation(command) {
      this.requireActiveIdle(command);
      if (command.payload.nextOperationId === this.currentOperationId) {
        protocolError("model-runtime-worker-next-operation-id");
      }
      this.stageOperation(1, this.currentOperationId);
      this.stageOperation(2, command.payload.nextOperationId);
      const state = this.callResult(
        "tinyrustlm_browser_runtime_advance_operation",
        [],
        validateState
      );
      if (state.operationId !== command.payload.nextOperationId ||
          state.activeComposition === null ||
          state.activeComposition.graphIdentitySha256 !== this.activeCompositionId) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-operation-state", true);
      }
      this.requireStatePolicy(state);
      this.currentOperationId = command.payload.nextOperationId;
      this.pendingCompositionId = command.payload.nextCompositionId === this.activeCompositionId
        ? null
        : command.payload.nextCompositionId;
      return this.eventResult(command, "operation-advanced", {
        commandMessageId: command.messageId,
        state,
        pendingCompositionId: this.pendingCompositionId
      }, false, { operationId: this.currentOperationId });
    }

    setTranscript(command) {
      this.requireActiveIdle(command);
      this.stageOperation(1, command.operationId);
      const state = this.callResult(
        "tinyrustlm_browser_runtime_set_transcript",
        [command.payload.revisionLow, command.payload.revisionHigh],
        validateState
      );
      if (state.state !== "active-idle" || state.operationId !== command.operationId ||
          state.transcriptRevisionLow !== command.payload.revisionLow ||
          state.transcriptRevisionHigh !== command.payload.revisionHigh) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-transcript-state", true);
      }
      this.requireStatePolicy(state);
      return this.eventResult(command, "transcript-updated", {
        commandMessageId: command.messageId,
        state
      }, false);
    }

    beginGeneration(command) {
      this.requireActiveIdle(command);
      if (this.completedGenerationIds.has(command.generationId)) {
        protocolError("model-runtime-worker-stale-generation");
      }
      if (!this.committedArtifacts.has("prompt-request")) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-request-required", false);
      }
      this.stageOperation(1, command.operationId);
      this.committedArtifacts.delete("prompt-request");
      const state = this.callResult(
        "tinyrustlm_browser_runtime_begin_request",
        [],
        validateState
      );
      if (state.state !== "generating" || state.operationId !== command.operationId) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-generation-state", true);
      }
      this.requireStatePolicy(state);
      this.activeGeneration = Object.freeze({
        conversationId: command.conversationId,
        turnId: command.turnId,
        generationId: command.generationId
      });
      return this.eventResult(command, "generation-begun", {
        commandMessageId: command.messageId,
        state
      }, false);
    }

    stepGeneration(command, cancelled) {
      this.requireActiveGeneration(command);
      this.stageOperation(1, command.operationId);
      const step = this.callResult(
        "tinyrustlm_browser_runtime_step",
        [cancelled ? 1 : 0],
        validateStep
      );
      if (step.committedKvBytes > this.policy.maximumKvBytes) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-step-memory-policy", true);
      }
      if (cancelled && step.status.kind !== "cancelled") {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-cancellation-state", true);
      }
      if (step.status.kind === "active") {
        return this.eventResult(command, "generation-step", {
          commandMessageId: command.messageId,
          step
        }, false);
      }
      return this.finishGeneration(command, step.status.kind);
    }

    finishGeneration(command, terminalKind) {
      this.stageOperation(1, command.operationId);
      let output;
      try {
        output = this.callResult(
          "tinyrustlm_browser_runtime_finish",
          [],
          (value) => validateOutput(value, this.policy.maximumSequenceTokens)
        );
      } catch (error) {
        if (error instanceof CommandRejection) error.terminate = true;
        throw error;
      }
      if (output.operationId !== command.operationId ||
          output.composition.graphIdentitySha256 !== this.activeCompositionId ||
          output.status.kind !== terminalKind) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-output-identity", true);
      }
      if (output.committedKvBytes > this.policy.maximumKvBytes) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-output-memory-policy", true);
      }
      this.completedGenerationIds.add(command.generationId);
      this.activeGeneration = null;
      return this.eventResult(command, "generation-complete", {
        commandMessageId: command.messageId,
        output
      }, false);
    }

    release(command) {
      this.requireCurrentComposition(command, true);
      const status = this.exports.tinyrustlm_browser_runtime_release() >>> 0;
      if (status !== 0) {
        const error = this.abiFailure(status);
        error.terminate = true;
        throw error;
      }
      this.dropOwners();
      this.terminated = true;
      return this.eventResult(command, "runtime-released", {
        commandMessageId: command.messageId
      }, true);
    }

    requireArtifactComposition(command, kind) {
      if (kind === "prompt-request") {
        this.requireActiveIdle(command);
        return;
      }
      if (this.pendingCompositionId === null ||
          command.compositionId !== this.pendingCompositionId) {
        protocolError("model-runtime-worker-stale-composition");
      }
    }

    requireArtifactLength(kind, length) {
      const definition = ARTIFACT_KINDS[kind];
      let accepted = true;
      if (Object.hasOwn(definition, "exact")) accepted = length === definition.exact;
      if (Object.hasOwn(definition, "exactMaximum")) {
        accepted = length > 0 && length <= definition.exactMaximum;
      }
      if (Object.hasOwn(definition, "maximum")) {
        accepted = length > 0 && length <= this.policy[definition.maximum];
      }
      if (!accepted) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-artifact-length", false);
      }
    }

    requireStatePolicy(state) {
      if (state.maximumLinearMemoryBytes !== this.policy.maximumLinearMemoryBytes ||
          state.observedLinearMemoryBytes > this.policy.maximumLinearMemoryBytes ||
          state.committedKvBytes > this.policy.maximumKvBytes) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-state-memory-policy", true);
      }
      if (state.activeComposition === null) {
        if (state.memoryPlan !== null) {
          commandRejection(STATUS_INTERNAL_FAILURE,
            "model-runtime-worker-state-memory-plan", true);
        }
        return;
      }
      const plan = state.memoryPlan;
      if (plan === null || plan.modelBytes > this.policy.maximumModelBytes ||
          plan.kvBytes > this.policy.maximumKvBytes ||
          plan.scratchBytes > this.policy.maximumScratchBytes) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-state-memory-plan", true);
      }
    }

    requireNoGeneration() {
      if (this.activeGeneration !== null) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-generation-active", false);
      }
    }

    requireCurrentComposition(command, allowPending) {
      const expected = allowPending && this.pendingCompositionId !== null
        ? this.pendingCompositionId
        : this.activeCompositionId;
      if (expected === null || command.compositionId !== expected) {
        protocolError("model-runtime-worker-stale-composition");
      }
    }

    requireActiveIdle(command) {
      this.requireNoGeneration();
      if (this.pendingCompositionId !== null || this.activeCompositionId === null) {
        commandRejection(STATUS_BOUNDARY_REJECTED,
          "model-runtime-worker-activation-required", false);
      }
      this.requireCurrentComposition(command, false);
    }

    requireActiveGeneration(command) {
      this.requireCurrentComposition(command, false);
      const active = this.activeGeneration;
      if (active === null || active.conversationId !== command.conversationId ||
          active.turnId !== command.turnId || active.generationId !== command.generationId ||
          this.completedGenerationIds.has(command.generationId)) {
        protocolError("model-runtime-worker-stale-generation");
      }
    }

    stageOperation(kind, identity) {
      const bytes = bytesFromHex(identity);
      let pointer = 0;
      try {
        pointer = this.exports.tinyrustlm_browser_runtime_transfer_begin(kind, 32) >>> 0;
        if (pointer === 0) this.throwPointerFailure();
        if (pointer + bytes.length > this.exports.memory.buffer.byteLength) {
          this.cancelPendingRawTransfer();
          commandRejection(STATUS_INTERNAL_FAILURE,
            "model-runtime-worker-operation-memory", true);
        }
        new Uint8Array(this.exports.memory.buffer, pointer, bytes.length).set(bytes);
        const status = this.exports.tinyrustlm_browser_runtime_transfer_commit(
          kind,
          pointer,
          bytes.length
        ) >>> 0;
        if (status !== 0) this.throwAbiFailure(status);
      } finally {
        bytes.fill(0);
      }
    }

    callResult(name, args, validator) {
      const status = this.exports[name](...args) >>> 0;
      if (status !== 0) this.throwAbiFailure(status);
      const length = this.exports.tinyrustlm_browser_runtime_result_len() >>> 0;
      const pointer = this.exports.tinyrustlm_browser_runtime_result_ptr() >>> 0;
      if (length === 0 || length > MAXIMUM_RESULT_BYTES || pointer === 0 ||
          pointer + length > this.exports.memory.buffer.byteLength) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-result-bounds", true);
      }
      let value;
      try {
        const bytes = new Uint8Array(this.exports.memory.buffer, pointer, length);
        value = JSON.parse(textDecoder().decode(bytes));
      } catch (_) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-result-json", true);
      }
      return validator(value);
    }

    readErrorCode() {
      const length = this.exports.tinyrustlm_browser_runtime_error_len() >>> 0;
      const pointer = this.exports.tinyrustlm_browser_runtime_error_ptr() >>> 0;
      if (length === 0 || length > 160 || pointer === 0 ||
          pointer + length > this.exports.memory.buffer.byteLength) {
        return "model-runtime-worker-abi-rejected";
      }
      let value = "";
      const bytes = new Uint8Array(this.exports.memory.buffer, pointer, length);
      for (const byte of bytes) {
        if (byte > 0x7f) return "model-runtime-worker-abi-rejected";
        value += String.fromCharCode(byte);
      }
      return stableCode(value, "model-runtime-worker-abi-rejected");
    }

    abiFailure(status) {
      const normalized = status === STATUS_BOUNDARY_REJECTED ||
        status === STATUS_RUNTIME_REJECTED || status === STATUS_INTERNAL_FAILURE
        ? status
        : STATUS_INTERNAL_FAILURE;
      return new CommandRejection(
        normalized,
        this.readErrorCode(),
        normalized === STATUS_INTERNAL_FAILURE
      );
    }

    throwAbiFailure(status) {
      throw this.abiFailure(status);
    }

    throwPointerFailure() {
      const code = this.readErrorCode();
      const internal = code === "browser-runtime-allocation" ||
        code === "browser-runtime-lock";
      commandRejection(
        internal ? STATUS_INTERNAL_FAILURE : STATUS_BOUNDARY_REJECTED,
        code,
        internal
      );
    }

    cancelPendingRawTransfer() {
      if (this.pendingArtifact === null) return;
      const status = this.exports.tinyrustlm_browser_runtime_transfer_cancel() >>> 0;
      this.pendingArtifact = null;
      if (status !== 0) {
        const error = this.abiFailure(status);
        error.terminate = true;
        throw error;
      }
    }

    async eventResult(command, kind, payload, terminate, identities) {
      if (!Object.hasOwn(EVENT_PAYLOAD_FIELDS, kind)) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-event-kind", true);
      }
      requireExactObject(payload, EVENT_PAYLOAD_FIELDS[kind],
        "model-runtime-worker-event-payload");
      if (this.nextEventSequence >= MAXIMUM_MESSAGES) {
        commandRejection(STATUS_INTERNAL_FAILURE,
          "model-runtime-worker-event-capacity", true);
      }
      const sequence = this.nextEventSequence;
      this.nextEventSequence += 1;
      const messageId = await deriveEventMessageId({
        workerId: this.workerId || command.workerId,
        commandMessageId: command.messageId,
        sequence,
        kind
      });
      const override = identities || {};
      const event = {
        schema: PROTOCOL_SCHEMA,
        workerId: this.workerId || command.workerId,
        operationId: override.operationId || this.currentOperationId || command.operationId,
        compositionId: override.compositionId || command.compositionId,
        conversationId: command.conversationId,
        turnId: command.turnId,
        generationId: command.generationId,
        messageId,
        sequence,
        kind,
        payload
      };
      return Object.freeze({ event: Object.freeze(event), terminate: terminate === true });
    }

    rejectionResult(command, rejection) {
      return this.eventResult(command, "command-rejected", {
        commandMessageId: command.messageId,
        status: rejection.status,
        code: stableCode(rejection.code, "model-runtime-worker-rejected"),
        workerTerminated: rejection.terminate
      }, rejection.terminate);
    }

    invalidate() {
      if (!this.terminated && this.exports && this.initialized) {
        try {
          this.exports.tinyrustlm_browser_runtime_release();
        } catch (_) {
          // The owner is discarded regardless of an untrusted terminal state.
        }
      }
      this.dropOwners();
      this.terminated = true;
    }

    dropOwners() {
      this.exports = null;
      this.policy = null;
      this.pendingArtifact = null;
      this.committedArtifacts.clear();
      this.activeGeneration = null;
      this.completedGenerationIds.clear();
      this.activeCompositionId = null;
      this.pendingCompositionId = null;
      this.initialized = false;
    }
  }

  function lockDownNetwork(scope) {
    if (scope === null || typeof scope !== "object") {
      protocolError("model-runtime-worker-network-scope");
    }
    for (const name of NETWORK_GLOBALS) {
      try {
        Object.defineProperty(scope, name, {
          configurable: false,
          enumerable: false,
          writable: false,
          value: undefined
        });
      } catch (_) {
        protocolError("model-runtime-worker-network-lockdown");
      }
      const descriptor = Object.getOwnPropertyDescriptor(scope, name);
      if (!descriptor || descriptor.value !== undefined || descriptor.configurable ||
          descriptor.writable) {
        protocolError("model-runtime-worker-network-lockdown");
      }
    }
  }

  function isDedicatedWorkerScope(scope) {
    return Boolean(scope) && typeof scope === "object" &&
      typeof scope.postMessage === "function" && typeof scope.close === "function" &&
      typeof scope.document === "undefined" && "importScripts" in scope;
  }

  function attachDedicatedWorker(scope) {
    if (!isDedicatedWorkerScope(scope)) {
      protocolError("model-runtime-worker-scope");
    }
    lockDownNetwork(scope);
    const controller = new ModelRuntimeWorker();
    scope.onmessage = (event) => {
      controller.enqueue(event.data).then((result) => {
        scope.postMessage(result.event);
        if (result.terminate) scope.setTimeout(() => scope.close(), 0);
      }).catch((error) => {
        scope.close();
        throw error;
      });
    };
    scope.onmessageerror = () => {
      controller.invalidate();
      scope.close();
    };
    return controller;
  }

  return Object.freeze({
    PROTOCOL_SCHEMA,
    MESSAGE_FIELDS,
    COMMAND_PAYLOAD_FIELDS,
    EVENT_PAYLOAD_FIELDS,
    ARTIFACT_KINDS,
    NETWORK_GLOBALS,
    WorkerProtocolError,
    ModelRuntimeWorker,
    deriveEventMessageId,
    lockDownNetwork,
    isDedicatedWorkerScope,
    attachDedicatedWorker
  });
}));
