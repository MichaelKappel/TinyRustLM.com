(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TinyRustLMModelRuntimeClient = api;
  }
}(typeof globalThis === "object" ? globalThis : this, function (root) {
  "use strict";

  const PROTOCOL_SCHEMA = "tinyrustlm.model-runtime-worker/1";
  const EVENT_ID_DOMAIN = "tinyrustlm.model-runtime-worker.event/1";
  const MAXIMUM_MESSAGES = 65536;
  const MAXIMUM_BINARY_CHUNK_BYTES = 4 * 1024 * 1024;
  const MAXIMUM_WASM_BYTES = 16 * 1024 * 1024;
  const MAXIMUM_COMMAND_TIMEOUT_MILLISECONDS = 10 * 60 * 1000;
  const ID_PATTERN = /^[0-9a-f]{64}$/u;
  const ERROR_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,159}$/u;
  // Capture the client asset location while its script is executing, independent of page routes.
  const browserClientScriptUrl = (() => {
    const document = root && root.document;
    const script = document && document.currentScript;
    if (!script || typeof script.src !== "string" || script.src.length === 0) {
      return null;
    }
    try {
      return new root.URL(script.src, document.baseURI).href;
    } catch (_) {
      return null;
    }
  })();
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
  const POLICY_FIELDS = Object.freeze([
    "maximumModelBytes",
    "maximumSequenceTokens",
    "maximumKvBytes",
    "maximumScratchBytes",
    "maximumResolvedMemberBytes",
    "maximumResidentDependencyBytes",
    "maximumRequestBytes",
    "maximumLinearMemoryBytes"
  ]);
  const INITIALIZE_FIELDS = Object.freeze([
    "operationId",
    "compositionId",
    "wasmBytes",
    "wasmSha256",
    "policy",
    "transcriptRevision"
  ]);
  const ARTIFACT_SOURCE_FIELDS = Object.freeze(["role", "byteLength", "chunks"]);
  const ACTIVATION_ROLES = Object.freeze([
    "model", "tokenizer", "template", "sampling", "prompt", "composition"
  ]);
  const ARTIFACT_LENGTHS = Object.freeze({
    model: Object.freeze({ minimum: 1 }),
    tokenizer: Object.freeze({ minimum: 1, maximum: 64 * 1024 * 1024 }),
    template: Object.freeze({ minimum: 1, maximum: 1024 * 1024 }),
    sampling: Object.freeze({ exact: 65800 }),
    prompt: Object.freeze({ exact: 512 }),
    composition: Object.freeze({ exact: 896 })
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
  const EXPECTED_EVENTS = Object.freeze({
    initialize: Object.freeze(["runtime-ready"]),
    "artifact-begin": Object.freeze(["artifact-transfer-begun"]),
    "artifact-chunk": Object.freeze(["artifact-chunk-accepted"]),
    "artifact-commit": Object.freeze(["artifact-transfer-committed"]),
    activate: Object.freeze(["composition-active"]),
    "advance-operation": Object.freeze(["operation-advanced"]),
    "set-transcript": Object.freeze(["transcript-updated"]),
    "begin-generation": Object.freeze(["generation-begun"]),
    "step-generation": Object.freeze(["generation-step", "generation-complete"]),
    "cancel-generation": Object.freeze(["generation-complete"]),
    release: Object.freeze(["runtime-released"])
  });
  const GENERATION_STATUS_KINDS = new Set([
    "active", "stop-token", "maximum-new-tokens", "context-limit", "cancelled"
  ]);
  const MAXIMUM_U64 = (1n << 64n) - 1n;

  class ModelRuntimeClientError extends Error {
    constructor(code, options) {
      super(code);
      this.name = "ModelRuntimeClientError";
      this.code = stableCode(code, "model-runtime-client-failed");
      this.status = options && Number.isInteger(options.status) ? options.status : 0;
      this.terminal = Boolean(options && options.terminal);
    }
  }

  function fail(code, options) {
    throw new ModelRuntimeClientError(code, options);
  }

  function stableCode(value, fallback) {
    return typeof value === "string" && ERROR_CODE_PATTERN.test(value) ? value : fallback;
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
      fail(code);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (keys.length !== fields.length || fields.some((field) => !Object.hasOwn(descriptors, field))) {
      fail(code);
    }
    for (const field of fields) {
      const descriptor = descriptors[field];
      if (!Object.hasOwn(descriptor, "value") || descriptor.get || descriptor.set) {
        fail(code);
      }
    }
    return value;
  }

  function requireId(value, code, allowZero) {
    if (typeof value !== "string" || !ID_PATTERN.test(value) ||
        (!allowZero && /^0{64}$/u.test(value))) {
      fail(code);
    }
    return value;
  }

  function requireUnsigned32(value, code, allowZero) {
    if (!Number.isInteger(value) || value < (allowZero ? 0 : 1) || value > 0xffffffff) {
      fail(code);
    }
    return value;
  }

  function requireSafeNonnegative(value, code) {
    if (!Number.isSafeInteger(value) || value < 0) {
      fail(code);
    }
    return value;
  }

  function requireSha256(value, code) {
    return requireId(value, code, true);
  }

  function requireArrayBuffer(value, code) {
    if (!(value instanceof ArrayBuffer) || value.byteLength === 0) {
      fail(code);
    }
    return value;
  }

  function requireU64(value, code) {
    let normalized;
    if (typeof value === "bigint") {
      normalized = value;
    } else if (Number.isSafeInteger(value) && value >= 0) {
      normalized = BigInt(value);
    } else {
      fail(code);
    }
    if (normalized < 0n || normalized > MAXIMUM_U64) {
      fail(code);
    }
    return normalized;
  }

  function splitU64(value, code) {
    const normalized = requireU64(value, code);
    return Object.freeze({
      low: Number(normalized & 0xffffffffn),
      high: Number((normalized >> 32n) & 0xffffffffn)
    });
  }

  function cryptoApi() {
    const value = root && root.crypto;
    if (!value || typeof value.getRandomValues !== "function" ||
        !value.subtle || typeof value.subtle.digest !== "function") {
      fail("model-runtime-client-web-crypto", { terminal: true });
    }
    return value;
  }

  function textEncoder() {
    if (!root || typeof root.TextEncoder !== "function") {
      fail("model-runtime-client-text-encoder", { terminal: true });
    }
    return new root.TextEncoder();
  }

  function bytesToHex(bytes) {
    let result = "";
    for (const byte of bytes) {
      result += byte.toString(16).padStart(2, "0");
    }
    return result;
  }

  async function sha256Hex(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      fail("model-runtime-client-sha256-input", { terminal: true });
    }
    let digest;
    try {
      digest = await cryptoApi().subtle.digest("SHA-256", bytes);
    } catch (_) {
      fail("model-runtime-client-sha256", { terminal: true });
    }
    return bytesToHex(new Uint8Array(digest));
  }

  function randomId() {
    const bytes = new Uint8Array(32);
    cryptoApi().getRandomValues(bytes);
    const value = bytesToHex(bytes);
    bytes.fill(0);
    return value;
  }

  async function identityFromText(domain, value) {
    if (typeof domain !== "string" || domain.length < 1 || domain.length > 160 ||
        typeof value !== "string" || value.length < 1 || value.length > 65536) {
      fail("model-runtime-client-identity-input");
    }
    return sha256Hex(textEncoder().encode(`${domain}\n${value}`));
  }

  async function deriveEventMessageId(value) {
    requireExactObject(value, ["workerId", "commandMessageId", "sequence", "kind"],
      "model-runtime-client-event-id-input");
    requireId(value.workerId, "model-runtime-client-event-worker-id", true);
    requireId(value.commandMessageId, "model-runtime-client-event-command-id", true);
    requireUnsigned32(value.sequence, "model-runtime-client-event-sequence", true);
    if (!Object.hasOwn(EVENT_PAYLOAD_FIELDS, value.kind)) {
      fail("model-runtime-client-event-kind", { terminal: true });
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

  function normalizePolicy(value) {
    const policy = requireExactObject(value, POLICY_FIELDS, "model-runtime-client-policy");
    const normalized = {};
    for (const field of POLICY_FIELDS) {
      normalized[field] = requireUnsigned32(
        policy[field],
        `model-runtime-client-${field.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`,
        false
      );
    }
    if (normalized.maximumModelBytes > 0x80000000 ||
        normalized.maximumSequenceTokens > 40960 ||
        normalized.maximumKvBytes > 0x80000000 ||
        normalized.maximumScratchBytes > 0x40000000 ||
        normalized.maximumResolvedMemberBytes > 0x88000000 ||
        normalized.maximumResidentDependencyBytes > 0x08000000 ||
        normalized.maximumRequestBytes > 0x01000000 ||
        normalized.maximumLinearMemoryBytes > 0xc0000000) {
      fail("model-runtime-client-policy");
    }
    return Object.freeze(normalized);
  }

  function normalizeArtifactLength(role, byteLength, policy) {
    if (!Object.hasOwn(ARTIFACT_LENGTHS, role) ||
        !Number.isSafeInteger(byteLength) || byteLength < 1) {
      fail("model-runtime-client-artifact-length");
    }
    const rule = ARTIFACT_LENGTHS[role];
    if ((rule.exact && byteLength !== rule.exact) ||
        (rule.maximum && byteLength > rule.maximum) ||
        (role === "model" && byteLength > policy.maximumModelBytes)) {
      fail("model-runtime-client-artifact-length");
    }
    return byteLength;
  }

  function validateGenerationStatus(value) {
    requireExactObject(value, ["kind", "stopTokenId"],
      "model-runtime-client-generation-status");
    if (!GENERATION_STATUS_KINDS.has(value.kind)) {
      fail("model-runtime-client-generation-status", { terminal: true });
    }
    if (value.kind === "stop-token") {
      requireUnsigned32(value.stopTokenId, "model-runtime-client-stop-token", true);
    } else if (value.stopTokenId !== null) {
      fail("model-runtime-client-stop-token", { terminal: true });
    }
    return value;
  }

  function validateCompositionIdentity(value, compositionId) {
    requireExactObject(value, [
      "artifactBytes", "artifactSha256", "graphIdentitySha256", "memberTableSha256"
    ], "model-runtime-client-composition");
    requireSafeNonnegative(value.artifactBytes, "model-runtime-client-composition");
    requireSha256(value.artifactSha256, "model-runtime-client-composition");
    requireSha256(value.graphIdentitySha256, "model-runtime-client-composition");
    requireSha256(value.memberTableSha256, "model-runtime-client-composition");
    if (value.graphIdentitySha256 !== compositionId) {
      fail("model-runtime-client-composition-identity", { terminal: true });
    }
    return value;
  }

  function validateState(value, operationId, compositionId, activeRequired) {
    requireExactObject(value, [
      "schema", "state", "operationId", "transcriptRevisionLow",
      "transcriptRevisionHigh", "activeComposition", "committedKvBytes",
      "memoryPlan", "observedLinearMemoryBytes", "maximumLinearMemoryBytes"
    ], "model-runtime-client-state");
    if (value.schema !== "tinyrustlm.browser_runtime_wasm.state/1" ||
        !new Set(["empty", "active-idle", "generating", "terminal-output-ready"])
          .has(value.state) || value.operationId !== operationId) {
      fail("model-runtime-client-state", { terminal: true });
    }
    requireUnsigned32(value.transcriptRevisionLow,
      "model-runtime-client-transcript-revision", true);
    requireUnsigned32(value.transcriptRevisionHigh,
      "model-runtime-client-transcript-revision", true);
    requireSafeNonnegative(value.committedKvBytes, "model-runtime-client-committed-kv");
    requireSafeNonnegative(value.observedLinearMemoryBytes,
      "model-runtime-client-linear-memory");
    requireUnsigned32(value.maximumLinearMemoryBytes,
      "model-runtime-client-linear-memory", true);
    if (activeRequired) {
      if (value.activeComposition === null || value.memoryPlan === null) {
        fail("model-runtime-client-active-state", { terminal: true });
      }
      validateCompositionIdentity(value.activeComposition, compositionId);
    } else if (value.activeComposition !== null || value.memoryPlan !== null) {
      fail("model-runtime-client-empty-state", { terminal: true });
    }
    if (value.memoryPlan !== null) {
      requireExactObject(value.memoryPlan, ["modelBytes", "kvBytes", "scratchBytes"],
        "model-runtime-client-memory-plan");
      for (const field of ["modelBytes", "kvBytes", "scratchBytes"]) {
        requireSafeNonnegative(value.memoryPlan[field], "model-runtime-client-memory-plan");
      }
    }
    return value;
  }

  function validateStep(value) {
    requireExactObject(value, [
      "schema", "selectedTokenId", "emittedTokenId", "status", "committedKvBytes"
    ], "model-runtime-client-step");
    if (value.schema !== "tinyrustlm.browser_runtime_wasm.step/1") {
      fail("model-runtime-client-step", { terminal: true });
    }
    for (const field of ["selectedTokenId", "emittedTokenId"]) {
      if (value[field] !== null) {
        requireUnsigned32(value[field], "model-runtime-client-token-id", true);
      }
    }
    validateGenerationStatus(value.status);
    requireSafeNonnegative(value.committedKvBytes, "model-runtime-client-committed-kv");
    return value;
  }

  function validateOutput(value, operationId, compositionId, maximumSequenceTokens) {
    requireExactObject(value, [
      "schema", "text", "tokenIds", "status", "composition", "operationId",
      "committedKvBytes"
    ], "model-runtime-client-output");
    if (value.schema !== "tinyrustlm.browser_runtime_wasm.output/1" ||
        typeof value.text !== "string" || !Array.isArray(value.tokenIds) ||
        value.tokenIds.length > maximumSequenceTokens || value.operationId !== operationId) {
      fail("model-runtime-client-output", { terminal: true });
    }
    for (const tokenId of value.tokenIds) {
      requireUnsigned32(tokenId, "model-runtime-client-token-id", true);
    }
    validateGenerationStatus(value.status);
    validateCompositionIdentity(value.composition, compositionId);
    requireSafeNonnegative(value.committedKvBytes, "model-runtime-client-committed-kv");
    return value;
  }

  async function* chunksFromBlob(blob, chunkBytes, signal) {
    if (!blob || typeof blob.slice !== "function" ||
        !Number.isSafeInteger(blob.size) || blob.size < 1) {
      fail("model-runtime-client-blob");
    }
    const size = chunkBytes === undefined ? MAXIMUM_BINARY_CHUNK_BYTES : chunkBytes;
    if (!Number.isInteger(size) || size < 1 || size > MAXIMUM_BINARY_CHUNK_BYTES) {
      fail("model-runtime-client-chunk-size");
    }
    for (let offset = 0; offset < blob.size; offset += size) {
      if (signal && signal.aborted) {
        fail("model-runtime-client-transfer-cancelled");
      }
      const end = Math.min(blob.size, offset + size);
      const bytes = await blob.slice(offset, end).arrayBuffer();
      if (bytes.byteLength !== end - offset) {
        fail("model-runtime-client-blob-short-read");
      }
      yield Object.freeze({ offset, bytes });
    }
  }

  function oneChunk(bytes) {
    const value = requireArrayBuffer(bytes, "model-runtime-client-chunk");
    return Object.freeze({
      async *[Symbol.asyncIterator]() {
        yield Object.freeze({ offset: 0, bytes: value });
      }
    });
  }

  class ModelRuntimeClient {
    constructor(options) {
      const source = requireExactObject(options, [
        "workerUrl", "workerFactory", "commandTimeoutMilliseconds"
      ], "model-runtime-client-options");
      if (typeof source.workerUrl !== "string" || source.workerUrl.length < 1 ||
          source.workerUrl.length > 2048 || typeof source.workerFactory !== "function") {
        fail("model-runtime-client-options");
      }
      if (!Number.isInteger(source.commandTimeoutMilliseconds) ||
          source.commandTimeoutMilliseconds < 1000 ||
          source.commandTimeoutMilliseconds > MAXIMUM_COMMAND_TIMEOUT_MILLISECONDS) {
        fail("model-runtime-client-timeout");
      }
      let worker;
      try {
        worker = source.workerFactory(source.workerUrl);
      } catch (_) {
        fail("model-runtime-client-worker-create", { terminal: true });
      }
      if (!worker || typeof worker.postMessage !== "function" ||
          typeof worker.terminate !== "function") {
        fail("model-runtime-client-worker", { terminal: true });
      }
      this.worker = worker;
      this.workerId = randomId();
      this.commandTimeoutMilliseconds = source.commandTimeoutMilliseconds;
      this.commandSequence = 0;
      this.eventSequence = 0;
      this.pending = null;
      this.eventTail = Promise.resolve();
      this.status = "created";
      this.operationId = null;
      this.compositionId = null;
      this.policy = null;
      this.controlIds = Object.freeze({
        conversationId: randomId(),
        turnId: randomId(),
        generationId: randomId()
      });
      this.activeGeneration = null;
      this.completedGenerationIds = new Set();
      worker.onmessage = (event) => {
        this.eventTail = this.eventTail
          .then(() => this.acceptEvent(event && event.data))
          .catch((error) => this.failTerminal(error));
      };
      worker.onerror = () => this.failTerminal(new ModelRuntimeClientError(
        "model-runtime-client-worker-error", { terminal: true }
      ));
      worker.onmessageerror = () => this.failTerminal(new ModelRuntimeClientError(
        "model-runtime-client-message-error", { terminal: true }
      ));
    }

    async initialize(options) {
      if (this.status !== "created") {
        fail("model-runtime-client-initialize-state");
      }
      const source = requireExactObject(options, INITIALIZE_FIELDS,
        "model-runtime-client-initialize");
      const operationId = requireId(source.operationId,
        "model-runtime-client-operation-id", false);
      const compositionId = requireId(source.compositionId,
        "model-runtime-client-composition-id", false);
      const wasmBytes = requireArrayBuffer(source.wasmBytes,
        "model-runtime-client-wasm-bytes");
      if (wasmBytes.byteLength > MAXIMUM_WASM_BYTES) {
        fail("model-runtime-client-wasm-bytes");
      }
      const wasmSha256 = requireSha256(source.wasmSha256,
        "model-runtime-client-wasm-sha256");
      const observedSha256 = await sha256Hex(new Uint8Array(wasmBytes));
      if (observedSha256 !== wasmSha256) {
        fail("model-runtime-client-wasm-sha256");
      }
      const policy = normalizePolicy(source.policy);
      const revision = splitU64(source.transcriptRevision,
        "model-runtime-client-transcript-revision");
      this.operationId = operationId;
      this.compositionId = compositionId;
      this.policy = policy;
      this.status = "initializing";
      const event = await this.send("initialize", {
        wasmBytes,
        wasmSha256,
        ...policy,
        transcriptRevisionLow: revision.low,
        transcriptRevisionHigh: revision.high
      }, this.controlIds, [wasmBytes]);
      validateState(event.payload.state, operationId, compositionId, false);
      if (event.payload.state.state !== "empty" ||
          event.payload.state.transcriptRevisionLow !== revision.low ||
          event.payload.state.transcriptRevisionHigh !== revision.high) {
        this.failTerminal(new ModelRuntimeClientError(
          "model-runtime-client-initialize-state", { terminal: true }
        ));
        fail("model-runtime-client-initialize-state", { terminal: true });
      }
      this.status = "ready";
      return event.payload.state;
    }

    async activate(artifacts, onProgress) {
      if (this.status !== "ready") {
        fail("model-runtime-client-activate-state");
      }
      if (!Array.isArray(artifacts) || artifacts.length !== ACTIVATION_ROLES.length ||
          artifacts.some((artifact, index) => !artifact ||
            artifact.role !== ACTIVATION_ROLES[index])) {
        fail("model-runtime-client-artifact-order");
      }
      if (onProgress !== undefined && typeof onProgress !== "function") {
        fail("model-runtime-client-progress-handler");
      }
      this.status = "activating";
      try {
        for (let index = 0; index < artifacts.length; index += 1) {
          const artifact = requireExactObject(
            artifacts[index],
            ARTIFACT_SOURCE_FIELDS,
            "model-runtime-client-artifact-source"
          );
          await this.transferArtifact(artifact.role, artifact.byteLength, artifact.chunks,
            this.controlIds, onProgress, index, artifacts.length);
        }
        const event = await this.send("activate", {}, this.controlIds);
        validateState(event.payload.state, this.operationId, this.compositionId, true);
        if (event.payload.state.state !== "active-idle") {
          fail("model-runtime-client-activate-state", { terminal: true });
        }
        this.status = "active";
        return event.payload.state;
      } catch (error) {
        this.failTerminal(error);
        throw error;
      }
    }

    async setTranscript(revision, conversationId) {
      if (this.status !== "active") {
        fail("model-runtime-client-transcript-state");
      }
      const identity = requireId(conversationId,
        "model-runtime-client-conversation-id", true);
      const normalized = splitU64(revision, "model-runtime-client-transcript-revision");
      const context = { ...this.controlIds, conversationId: identity };
      const event = await this.send("set-transcript", {
        revisionLow: normalized.low,
        revisionHigh: normalized.high
      }, context);
      validateState(event.payload.state, this.operationId, this.compositionId, true);
      if (event.payload.state.transcriptRevisionLow !== normalized.low ||
          event.payload.state.transcriptRevisionHigh !== normalized.high) {
        this.failTerminal(new ModelRuntimeClientError(
          "model-runtime-client-transcript-state", { terminal: true }
        ));
        fail("model-runtime-client-transcript-state", { terminal: true });
      }
      return event.payload.state;
    }

    async advanceOperation(options) {
      if (this.status !== "active" || this.activeGeneration !== null) {
        fail("model-runtime-client-advance-state");
      }
      const source = requireExactObject(
        options,
        ["operationId", "compositionId"],
        "model-runtime-client-advance"
      );
      const nextOperationId = requireId(
        source.operationId,
        "model-runtime-client-next-operation-id",
        false
      );
      const nextCompositionId = requireId(
        source.compositionId,
        "model-runtime-client-next-composition-id",
        false
      );
      if (nextOperationId === this.operationId) {
        fail("model-runtime-client-next-operation-id");
      }
      const activeCompositionId = this.compositionId;
      this.status = "advancing";
      try {
        const event = await this.send("advance-operation", {
          nextOperationId,
          nextCompositionId
        }, this.controlIds);
        validateState(
          event.payload.state,
          nextOperationId,
          activeCompositionId,
          true
        );
        const expectedPending = nextCompositionId === activeCompositionId
          ? null
          : nextCompositionId;
        if (event.operationId !== nextOperationId ||
            event.compositionId !== activeCompositionId ||
            event.payload.pendingCompositionId !== expectedPending ||
            event.payload.state.state !== "active-idle") {
          fail("model-runtime-client-advance-state", { terminal: true });
        }
        this.operationId = nextOperationId;
        this.compositionId = nextCompositionId;
        this.status = expectedPending === null ? "active" : "ready";
        return Object.freeze({
          state: event.payload.state,
          pendingCompositionId: expectedPending
        });
      } catch (error) {
        this.failTerminal(error);
        throw error;
      }
    }

    async generate(options) {
      if (this.status !== "active" || this.activeGeneration !== null) {
        fail("model-runtime-client-generation-state");
      }
      const source = requireExactObject(options, [
        "conversationId", "turnId", "generationId", "promptRequest", "signal", "onStep"
      ], "model-runtime-client-generation");
      const context = Object.freeze({
        conversationId: requireId(source.conversationId,
          "model-runtime-client-conversation-id", true),
        turnId: requireId(source.turnId, "model-runtime-client-turn-id", true),
        generationId: requireId(source.generationId,
          "model-runtime-client-generation-id", true)
      });
      if (this.completedGenerationIds.has(context.generationId)) {
        fail("model-runtime-client-generation-replay");
      }
      const promptRequest = requireArrayBuffer(source.promptRequest,
        "model-runtime-client-prompt-request");
      if (promptRequest.byteLength > this.policy.maximumRequestBytes) {
        fail("model-runtime-client-prompt-request");
      }
      if (source.signal !== null && source.signal !== undefined &&
          (typeof source.signal !== "object" || typeof source.signal.aborted !== "boolean" ||
           typeof source.signal.addEventListener !== "function" ||
           typeof source.signal.removeEventListener !== "function")) {
        fail("model-runtime-client-abort-signal");
      }
      if (source.onStep !== undefined && source.onStep !== null &&
          typeof source.onStep !== "function") {
        fail("model-runtime-client-step-handler");
      }
      const generation = {
        ...context,
        cancelRequested: Boolean(source.signal && source.signal.aborted)
      };
      const requestCancellation = () => {
        generation.cancelRequested = true;
      };
      if (source.signal) {
        source.signal.addEventListener("abort", requestCancellation, { once: true });
      }
      this.activeGeneration = generation;
      this.status = "generating";
      try {
        await this.transferArtifact(
          "prompt-request",
          promptRequest.byteLength,
          oneChunk(promptRequest),
          context
        );
        const begun = await this.send("begin-generation", {}, context);
        validateState(
          begun.payload.state,
          this.operationId,
          this.compositionId,
          true
        );
        if (begun.payload.state.state !== "generating") {
          fail("model-runtime-client-generation-state", { terminal: true });
        }
        for (;;) {
          const kind = generation.cancelRequested ? "cancel-generation" : "step-generation";
          const event = await this.send(kind, {}, context);
          if (event.kind === "generation-step") {
            const step = validateStep(event.payload.step);
            if (source.onStep) {
              source.onStep(Object.freeze({ ...step }));
            }
            continue;
          }
          const output = validateOutput(
            event.payload.output,
            this.operationId,
            this.compositionId,
            this.policy.maximumSequenceTokens
          );
          this.completedGenerationIds.add(context.generationId);
          this.activeGeneration = null;
          this.status = "active";
          return Object.freeze(output);
        }
      } catch (error) {
        this.failTerminal(error);
        throw error;
      } finally {
        if (source.signal) {
          source.signal.removeEventListener("abort", requestCancellation);
        }
      }
    }

    requestCancellation() {
      if (this.activeGeneration === null || this.status !== "generating") {
        return false;
      }
      this.activeGeneration.cancelRequested = true;
      return true;
    }

    async release() {
      if (this.status === "terminated") {
        return false;
      }
      if (this.status !== "ready" && this.status !== "active") {
        fail("model-runtime-client-release-state");
      }
      await this.send("release", {}, this.controlIds);
      this.finishTerminal();
      return true;
    }

    terminate(code) {
      if (this.status === "terminated") {
        return false;
      }
      this.failTerminal(new ModelRuntimeClientError(
        stableCode(code, "model-runtime-client-terminated"),
        { terminal: true }
      ));
      return true;
    }

    async transferArtifact(role, byteLength, chunks, context, onProgress,
      artifactIndex, artifactCount) {
      const maximum = role === "prompt-request"
        ? this.policy.maximumRequestBytes
        : undefined;
      if (role === "prompt-request") {
        if (!Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > maximum) {
          fail("model-runtime-client-artifact-length");
        }
      } else {
        normalizeArtifactLength(role, byteLength, this.policy);
      }
      if (!chunks || typeof chunks[Symbol.asyncIterator] !== "function") {
        fail("model-runtime-client-artifact-chunks");
      }
      const begun = await this.send(
        "artifact-begin",
        { artifactKind: role, byteLength },
        context
      );
      if (begun.payload.artifactKind !== role || begun.payload.byteLength !== byteLength) {
        fail("model-runtime-client-artifact-begin", { terminal: true });
      }
      let nextOffset = 0;
      try {
        for await (const candidate of chunks) {
          const chunk = requireExactObject(candidate, ["offset", "bytes"],
            "model-runtime-client-artifact-chunk");
          const bytes = requireArrayBuffer(chunk.bytes,
            "model-runtime-client-artifact-chunk");
          const observedLength = bytes.byteLength;
          if (chunk.offset !== nextOffset || observedLength > MAXIMUM_BINARY_CHUNK_BYTES ||
              nextOffset + observedLength > byteLength) {
            fail("model-runtime-client-artifact-chunk");
          }
          // Preserve producer buffer lengths for offset accounting, then erase transferred material.
          const transferBytes = bytes.slice(0);
          new Uint8Array(bytes).fill(0);
          let event;
          try {
            event = await this.send("artifact-chunk", {
              artifactKind: role,
              offset: nextOffset,
              bytes: transferBytes
            }, context, [transferBytes]);
          } finally {
            if (transferBytes.byteLength > 0) {
              new Uint8Array(transferBytes).fill(0);
            }
          }
          if (event.payload.artifactKind !== role ||
              event.payload.offset !== nextOffset ||
              event.payload.byteLength !== observedLength ||
              event.payload.nextOffset !== nextOffset + observedLength) {
            fail("model-runtime-client-artifact-progress", { terminal: true });
          }
          nextOffset += observedLength;
          if (onProgress) {
            onProgress(Object.freeze({
              role,
              artifactIndex,
              artifactCount,
              completedBytes: nextOffset,
              totalBytes: byteLength
            }));
          }
        }
        if (nextOffset !== byteLength) {
          fail("model-runtime-client-artifact-short-read");
        }
        const committed = await this.send("artifact-commit", { artifactKind: role }, context);
        if (committed.payload.artifactKind !== role ||
            committed.payload.byteLength !== byteLength) {
          fail("model-runtime-client-artifact-commit", { terminal: true });
        }
      } catch (error) {
        this.failTerminal(error);
        throw error;
      }
    }

    send(kind, payload, context, transfer) {
      if (this.status === "terminated" || this.worker === null) {
        return Promise.reject(new ModelRuntimeClientError(
          "model-runtime-client-terminated", { terminal: true }
        ));
      }
      if (this.pending !== null || !Object.hasOwn(EXPECTED_EVENTS, kind) ||
          this.commandSequence >= MAXIMUM_MESSAGES) {
        return Promise.reject(new ModelRuntimeClientError(
          "model-runtime-client-command-state", { terminal: this.pending !== null }
        ));
      }
      const identities = context || this.controlIds;
      const command = {
        schema: PROTOCOL_SCHEMA,
        workerId: this.workerId,
        operationId: this.operationId,
        compositionId: this.compositionId,
        conversationId: identities.conversationId,
        turnId: identities.turnId,
        generationId: identities.generationId,
        messageId: randomId(),
        sequence: this.commandSequence,
        kind,
        payload
      };
      this.commandSequence += 1;
      return new Promise((resolve, reject) => {
        const timeout = root.setTimeout(() => {
          this.failTerminal(new ModelRuntimeClientError(
            "model-runtime-client-command-timeout", { terminal: true }
          ));
        }, this.commandTimeoutMilliseconds);
        this.pending = {
          command,
          expectedEvents: EXPECTED_EVENTS[kind],
          timeout,
          resolve,
          reject
        };
        try {
          this.worker.postMessage(command, transfer || []);
        } catch (_) {
          this.failTerminal(new ModelRuntimeClientError(
            "model-runtime-client-command-send", { terminal: true }
          ));
        }
      });
    }

    async acceptEvent(input) {
      const pending = this.pending;
      if (pending === null || this.status === "terminated") {
        fail("model-runtime-client-unsolicited-event", { terminal: true });
      }
      const event = requireExactObject(input, MESSAGE_FIELDS,
        "model-runtime-client-event-fields");
      const expectedOperationId = pending.command.kind === "advance-operation" &&
        event.kind === "operation-advanced"
        ? pending.command.payload.nextOperationId
        : pending.command.operationId;
      if (event.schema !== PROTOCOL_SCHEMA || event.workerId !== this.workerId ||
          event.operationId !== expectedOperationId ||
          event.compositionId !== pending.command.compositionId ||
          event.conversationId !== pending.command.conversationId ||
          event.turnId !== pending.command.turnId ||
          event.generationId !== pending.command.generationId ||
          event.sequence !== this.eventSequence ||
          !Number.isInteger(event.sequence) || event.sequence < 0 ||
          event.sequence >= MAXIMUM_MESSAGES ||
          (!pending.expectedEvents.includes(event.kind) && event.kind !== "command-rejected")) {
        fail("model-runtime-client-event-authority", { terminal: true });
      }
      requireExactObject(event.payload, EVENT_PAYLOAD_FIELDS[event.kind],
        "model-runtime-client-event-payload");
      if (event.payload.commandMessageId !== pending.command.messageId) {
        fail("model-runtime-client-event-command", { terminal: true });
      }
      const expectedMessageId = await deriveEventMessageId({
        workerId: event.workerId,
        commandMessageId: pending.command.messageId,
        sequence: event.sequence,
        kind: event.kind
      });
      if (event.messageId !== expectedMessageId) {
        fail("model-runtime-client-event-message-id", { terminal: true });
      }
      if (event.kind === "command-rejected" &&
          (!Number.isInteger(event.payload.status) ||
           event.payload.status < 1 || event.payload.status > 3 ||
           typeof event.payload.code !== "string" ||
           !ERROR_CODE_PATTERN.test(event.payload.code) ||
           typeof event.payload.workerTerminated !== "boolean")) {
        fail("model-runtime-client-rejection", { terminal: true });
      }
      this.eventSequence += 1;
      root.clearTimeout(pending.timeout);
      this.pending = null;
      if (event.kind === "command-rejected") {
        const terminal = event.payload.workerTerminated === true;
        const error = new ModelRuntimeClientError(event.payload.code, {
          status: event.payload.status,
          terminal
        });
        if (terminal) {
          this.finishTerminal();
        }
        pending.reject(error);
        return;
      }
      if (event.kind === "runtime-released") {
        this.finishTerminal();
      }
      pending.resolve(Object.freeze(event));
    }

    failTerminal(error) {
      const normalized = error instanceof ModelRuntimeClientError
        ? error
        : new ModelRuntimeClientError("model-runtime-client-internal", { terminal: true });
      normalized.terminal = true;
      const pending = this.pending;
      if (pending !== null) {
        root.clearTimeout(pending.timeout);
        this.pending = null;
        pending.reject(normalized);
      }
      this.finishTerminal();
      return normalized;
    }

    finishTerminal() {
      if (this.status === "terminated") {
        return;
      }
      const worker = this.worker;
      this.worker = null;
      this.status = "terminated";
      this.activeGeneration = null;
      this.policy = null;
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        try {
          worker.terminate();
        } catch (_) {
          // The owner is already terminal and no runtime state remains authoritative.
        }
      }
    }
  }

  function browserWorkerFactory(url) {
    if (!root || typeof root.Worker !== "function") {
      fail("model-runtime-client-worker-unavailable", { terminal: true });
    }
    return new root.Worker(url, { name: "tinyrustlm-model-runtime" });
  }

  // Resolve a sibling worker against the client script, preserving non-browser callers.
  function resolveBrowserWorkerUrl(workerUrl) {
    if (typeof workerUrl !== "string" || workerUrl.length < 1 || workerUrl.length > 2048) {
      fail("model-runtime-client-worker-url", { terminal: true });
    }
    if (browserClientScriptUrl === null) return workerUrl;
    try {
      return new root.URL(workerUrl, browserClientScriptUrl).href;
    } catch (_) {
      fail("model-runtime-client-worker-url", { terminal: true });
    }
  }

  function createBrowserClient(workerUrl, commandTimeoutMilliseconds) {
    return new ModelRuntimeClient({
      workerUrl: resolveBrowserWorkerUrl(workerUrl),
      workerFactory: browserWorkerFactory,
      commandTimeoutMilliseconds
    });
  }

  return Object.freeze({
    PROTOCOL_SCHEMA,
    MESSAGE_FIELDS,
    POLICY_FIELDS,
    ACTIVATION_ROLES,
    EVENT_PAYLOAD_FIELDS,
    EXPECTED_EVENTS,
    MAXIMUM_BINARY_CHUNK_BYTES,
    MAXIMUM_WASM_BYTES,
    ModelRuntimeClientError,
    ModelRuntimeClient,
    chunksFromBlob,
    oneChunk,
    identityFromText,
    deriveEventMessageId,
    createBrowserClient
  });
}));
